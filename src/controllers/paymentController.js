import asyncHandler from "../middleware/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { Payment, Event, Client } from "../models/index.js";

/**
 * @desc    Get all payments (non-archived by default) with SEARCH support
 * @route   GET /api/v1/payments
 * @access  Private
 */
export const getPayments = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    type,
    status,
    method,
    eventId,
    clientId,
    startDate,
    endDate,
    search, // ✅ Extract search param
    includeArchived = false,
  } = req.query;

  // Build query
  const query = { venueId: req.user.venueId };

  // --- START SEARCH LOGIC ---
  if (search) {
    const searchRegex = new RegExp(search, "i"); // Case-insensitive regex

    // 1. Find matching Clients (by name or email)
    const matchingClients = await Client.find({
      venueId: req.user.venueId,
      $or: [{ name: searchRegex }, { email: searchRegex }],
    }).select("_id");
    const clientIds = matchingClients.map((c) => c._id);

    // 2. Find matching Events (by title)
    const matchingEvents = await Event.find({
      venueId: req.user.venueId,
      title: searchRegex,
    }).select("_id");
    const eventIds = matchingEvents.map((e) => e._id);

    // 3. Apply $or condition to Payment query
    query.$or = [
      { description: searchRegex }, // Search inside Payment description
      { reference: searchRegex },   // Search inside Payment reference
      { client: { $in: clientIds } }, // Match payments belonging to found clients
      { event: { $in: eventIds } },   // Match payments belonging to found events
    ];
  }
  // --- END SEARCH LOGIC ---

  if (type) query.type = type;
  if (status) query.status = status;
  if (method) query.method = method;
  if (eventId) query.event = eventId;
  if (clientId) query.client = clientId;

  if (!includeArchived) {
    query.isArchived = false;
  }

  // Date range filter
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  // Pagination
  const skip = (page - 1) * limit;

  // Execute query
  const [payments, total] = await Promise.all([
    Payment.find(query)
      .populate("event", "title startDate")
      .populate("client", "name email")
      .populate("processedBy", "name email")
      .populate("archivedBy", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Payment.countDocuments(query),
  ]);

  new ApiResponse({
    payments,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit),
    },
  }).send(res);
});

/**
 * @desc    Get single payment (including archived)
 * @route   GET /api/v1/payments/:id
 * @access  Private
 */
export const getPayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  })
    .populate("event")
    .populate("client")
    .populate("processedBy", "name email")
    .populate("archivedBy", "name email");

  if (!payment) {
    throw new ApiError("Payment not found", 404);
  }

  new ApiResponse({ payment }).send(res);
});

/**
 * @desc    Create new payment
 * @route   POST /api/v1/payments
 * @access  Private (payments.create)
 */
export const createPayment = asyncHandler(async (req, res) => {
  const paymentData = {
    ...req.body,
    venueId: req.user.venueId,
    processedBy: req.user._id,
    isArchived: false, // Ensure new payments are not archived
  };

  // Verify event exists if provided
  if (paymentData.event) {
    const event = await Event.findOne({
      _id: paymentData.event,
      venueId: req.user.venueId,
    });

    if (!event) {
      throw new ApiError("Event not found", 404);
    }

    // Auto-set client from event if not provided
    if (!paymentData.client) {
      paymentData.client = event.clientId;
    }
  }

  // Verify client exists if provided
  if (paymentData.client) {
    const client = await Client.findOne({
      _id: paymentData.client,
      venueId: req.user.venueId,
    });

    if (!client) {
      throw new ApiError("Client not found", 404);
    }
  }

  const payment = await Payment.create(paymentData);

  // Update event payment summary if payment is for an event and not archived
  if (payment.event && payment.type === "income" && !payment.isArchived) {
    await updateEventPaymentSummary(payment.event);
  }

  await payment.populate([
    { path: "event", select: "title startDate" },
    { path: "client", select: "name email" },
  ]);

  new ApiResponse({ payment }, "Payment created successfully", 201).send(res);
});

/**
 * @desc    Update payment
 * @route   PUT /api/v1/payments/:id
 * @access  Private (payments.update.all)
 */
export const updatePayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  });

  if (!payment) {
    throw new ApiError("Payment not found", 404);
  }

  if (payment.isArchived) {
    throw new ApiError("Cannot update an archived payment", 400);
  }

  // If status is being changed to completed, set paidDate
  if (req.body.status === "completed" && payment.status !== "completed") {
    req.body.paidDate = new Date();
  }

  Object.assign(payment, req.body);
  await payment.save();

  // Update event payment summary if applicable
  if (payment.event && payment.type === "income") {
    await updateEventPaymentSummary(payment.event);
  }

  await payment.populate([
    { path: "event", select: "title startDate" },
    { path: "client", select: "name email" },
  ]);

  new ApiResponse({ payment }, "Payment updated successfully").send(res);
});

/**
 * @desc    Archive payment (soft delete)
 * @route   DELETE /api/v1/payments/:id
 * @access  Private (payments.delete.all)
 */
export const deletePayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  });

  if (!payment) {
    throw new ApiError("Payment not found", 404);
  }

  if (payment.isArchived) {
    throw new ApiError("Payment is already archived", 400);
  }

  // Soft delete: Archive the payment instead of deleting
  payment.isArchived = true;
  payment.archivedAt = new Date();
  payment.archivedBy = req.user._id;
  await payment.save();

  // Update event payment summary if this payment was associated with an event
  if (payment.event && payment.type === "income") {
    await updateEventPaymentSummary(payment.event);
  }

  new ApiResponse(null, "Payment archived successfully").send(res);
});

/**
 * @desc    Restore archived payment
 * @route   PATCH /api/v1/payments/:id/restore
 * @access  Private (payments.update.all)
 */
export const restorePayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  });

  if (!payment) {
    throw new ApiError("Payment not found", 404);
  }

  if (!payment.isArchived) {
    throw new ApiError("Payment is not archived", 400);
  }

  payment.isArchived = false;
  payment.archivedAt = undefined;
  payment.archivedBy = undefined;
  await payment.save();

  // Update event payment summary if this payment is associated with an event
  if (payment.event && payment.type === "income") {
    await updateEventPaymentSummary(payment.event);
  }

  await payment.populate([
    { path: "event", select: "title startDate" },
    { path: "client", select: "name email" },
  ]);

  new ApiResponse({ payment }, "Payment restored successfully").send(res);
});

/**
 * @desc    Get payment statistics (non-archived only)
 * @route   GET /api/v1/payments/stats
 * @access  Private
 */
export const getPaymentStats = asyncHandler(async (req, res) => {
  const venueId = req.user.venueId;
  const { startDate, endDate } = req.query;

  const dateFilter = { 
    venueId,
    isArchived: false // Only count non-archived payments
  };
  
  if (startDate || endDate) {
    dateFilter.createdAt = {};
    if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
    if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
  }

  const stats = await Payment.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: {
          type: "$type",
          status: "$status",
        },
        count: { $sum: 1 },
        totalAmount: { $sum: "$amount" },
        totalNetAmount: { $sum: "$netAmount" },
      },
    },
  ]);

  // Payment methods distribution
  const methodStats = await Payment.aggregate([
    { $match: { ...dateFilter, status: "completed" } },
    {
      $group: {
        _id: "$method",
        count: { $sum: 1 },
        totalAmount: { $sum: "$amount" },
      },
    },
  ]);

  // Calculate totals
  const totals = {
    totalIncome: 0,
    totalExpense: 0,
    pendingPayments: 0,
    completedPayments: 0,
    archivedPayments: 0,
  };

  stats.forEach((stat) => {
    if (stat._id.type === "income" && stat._id.status === "completed") {
      totals.totalIncome += stat.totalNetAmount;
    }
    if (stat._id.type === "expense" && stat._id.status === "completed") {
      totals.totalExpense += stat.totalNetAmount;
    }
    if (stat._id.status === "pending") {
      totals.pendingPayments += stat.totalAmount;
    }
    if (stat._id.status === "completed") {
      totals.completedPayments += stat.count;
    }
  });

  // Get archived payments count
  totals.archivedPayments = await Payment.countDocuments({
    venueId,
    isArchived: true,
  });

  totals.netRevenue = totals.totalIncome - totals.totalExpense;

  new ApiResponse({
    stats,
    methodStats,
    totals,
  }).send(res);
});

/**
 * @desc    Process refund
 * @route   POST /api/v1/payments/:id/refund
 * @access  Private (payments.update.all)
 */
export const processRefund = asyncHandler(async (req, res) => {
  const { refundAmount, refundReason } = req.body;

  const payment = await Payment.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  });

  if (!payment) {
    throw new ApiError("Payment not found", 404);
  }

  if (payment.isArchived) {
    throw new ApiError("Cannot refund an archived payment", 400);
  }

  if (payment.status !== "completed") {
    throw new ApiError("Can only refund completed payments", 400);
  }

  if (refundAmount > payment.amount) {
    throw new ApiError("Refund amount cannot exceed payment amount", 400);
  }

  payment.refundAmount = refundAmount;
  payment.refundDate = new Date();
  payment.refundReason = refundReason;
  payment.status = "refunded";

  await payment.save();

  // Update event payment summary if applicable
  if (payment.event && payment.type === "income") {
    await updateEventPaymentSummary(payment.event);
  }

  new ApiResponse({ payment }, "Refund processed successfully").send(res);
});

/**
 * @desc    Get archived payments
 * @route   GET /api/v1/payments/archived
 * @access  Private
 */
export const getArchivedPayments = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    type,
    method,
    sortBy = "archivedAt",
    order = "desc",
  } = req.query;

  // Build query for archived payments only
  const query = { 
    venueId: req.user.venueId,
    isArchived: true 
  };

  if (type) query.type = type;
  if (method) query.method = method;

  // Pagination
  const skip = (page - 1) * limit;

  // Sort
  const sortOrder = order === "asc" ? 1 : -1;
  const sortOptions = { [sortBy]: sortOrder };

  // Execute query
  const [payments, total] = await Promise.all([
    Payment.find(query)
      .populate("event", "title startDate")
      .populate("client", "name email")
      .populate("processedBy", "name email")
      .populate("archivedBy", "name email")
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit)),
    Payment.countDocuments(query),
  ]);

  new ApiResponse({
    payments,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit),
    },
  }).send(res);
});

/**
 * @desc    Helper function to update event payment summary
 */
const updateEventPaymentSummary = async (eventId) => {
  const event = await Event.findById(eventId);
  if (!event) return;

  // Get all non-archived completed income payments for this event
  const allPayments = await Payment.find({
    event: eventId,
    status: "completed",
    type: "income",
    isArchived: false,
  });

  const totalPaid = allPayments.reduce((sum, p) => sum + p.netAmount, 0);

  // ✅ FIX: Initialize paymentSummary if it is missing
  if (!event.paymentSummary) {
    event.paymentSummary = {
      paidAmount: 0,
      status: 'pending'
    };
  }

  // Now it is safe to assign
  event.paymentSummary.paidAmount = totalPaid;

  // ✅ FIX: Safety check for pricing object as well
  const totalEventCost = event.pricing ? event.pricing.totalAmount : 0;

  // Update payment status
  if (totalEventCost > 0 && totalPaid >= totalEventCost) {
    event.paymentSummary.status = "paid";
  } else if (totalPaid > 0) {
    event.paymentSummary.status = "partial";
  } else {
    event.paymentSummary.status = "pending";
  }

  await event.save();
};