import asyncHandler from "../middleware/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { Payment, Event, Client } from "../models/index.js";

/**
 * @desc    Get all payments
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
  } = req.query;

  // Build query
  const query = { venueId: req.user.venueId };

  if (type) query.type = type;
  if (status) query.status = status;
  if (method) query.method = method;
  if (eventId) query.event = eventId;
  if (clientId) query.client = clientId;

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
 * @desc    Get single payment
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
    .populate("processedBy", "name email");

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

  // Update event payment summary if payment is for an event
  if (payment.event && payment.type === "income") {
    const event = await Event.findById(payment.event);
    
    // Add payment to event's payments array
    event.payments.push(payment._id);
    
    // Update payment summary
    const allPayments = await Payment.find({
      event: payment.event,
      status: "completed",
      type: "income",
    });

    const totalPaid = allPayments.reduce((sum, p) => sum + p.netAmount, 0);
    event.paymentSummary.paidAmount = totalPaid;

    // Update payment status
    if (totalPaid >= event.pricing.totalAmount) {
      event.paymentSummary.status = "paid";
    } else if (totalPaid > 0) {
      event.paymentSummary.status = "partial";
    }

    await event.save();
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

  // If status is being changed to completed, set paidDate
  if (req.body.status === "completed" && payment.status !== "completed") {
    req.body.paidDate = new Date();
  }

  Object.assign(payment, req.body);
  await payment.save();

  // Update event payment summary if applicable
  if (payment.event) {
    const event = await Event.findById(payment.event);
    const allPayments = await Payment.find({
      event: payment.event,
      status: "completed",
      type: "income",
    });

    const totalPaid = allPayments.reduce((sum, p) => sum + p.netAmount, 0);
    event.paymentSummary.paidAmount = totalPaid;

    if (totalPaid >= event.pricing.totalAmount) {
      event.paymentSummary.status = "paid";
    } else if (totalPaid > 0) {
      event.paymentSummary.status = "partial";
    } else {
      event.paymentSummary.status = "pending";
    }

    await event.save();
  }

  await payment.populate([
    { path: "event", select: "title startDate" },
    { path: "client", select: "name email" },
  ]);

  new ApiResponse({ payment }, "Payment updated successfully").send(res);
});

/**
 * @desc    Delete payment
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

  // Remove payment from event if applicable
  if (payment.event) {
    const event = await Event.findById(payment.event);
    event.payments = event.payments.filter(
      (p) => p.toString() !== payment._id.toString()
    );
    await event.save();
  }

  await payment.deleteOne();

  new ApiResponse(null, "Payment deleted successfully").send(res);
});

/**
 * @desc    Get payment statistics
 * @route   GET /api/v1/payments/stats
 * @access  Private
 */
export const getPaymentStats = asyncHandler(async (req, res) => {
  const venueId = req.user.venueId;
  const { startDate, endDate } = req.query;

  const dateFilter = { venueId };
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

  new ApiResponse({ payment }, "Refund processed successfully").send(res);
});