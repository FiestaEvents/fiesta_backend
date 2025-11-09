import asyncHandler from "../middleware/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { Client, Event,Payment } from "../models/index.js";

/**
 * @desc    Get all clients
 * @route   GET /api/v1/clients
 * @access  Private
 */
export const getClients = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    status,
    search,
    sortBy = "createdAt",
    order = "desc",
  } = req.query;

  // Build query
  const query = { venueId: req.user.venueId };

  if (status) query.status = status;

  // Search by name or email
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
    ];
  }

  // Pagination
  const skip = (page - 1) * limit;

  // Sort
  const sortOrder = order === "asc" ? 1 : -1;
  const sortOptions = { [sortBy]: sortOrder };

  // Execute query
  const [clients, total] = await Promise.all([
    Client.find(query)
      .populate("createdBy", "name email")
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit)),
    Client.countDocuments(query),
  ]);

  // Get event count for each client
  const clientsWithEventCount = await Promise.all(
    clients.map(async (client) => {
      const eventCount = await Event.countDocuments({ clientId: client._id });
      return {
        ...client.toObject(),
        eventCount,
      };
    })
  );

  new ApiResponse({
    clients: clientsWithEventCount,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit),
    },
  }).send(res);
});

/**
 * @desc    Get single client
 * @route   GET /api/v1/clients/:id
 * @access  Private
 */
/**
 * @desc    Get single client
 * @route   GET /api/v1/clients/:id
 * @access  Private
 */
export const getClient = asyncHandler(async (req, res) => {
  const client = await Client.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  }).populate("createdBy", "name email");

  if (!client) {
    throw new ApiError("Client not found", 404);
  }

  // Get client's events with payment information
  const events = await Event.find({ clientId: client._id })
    .select("title type startDate endDate status pricing paymentSummary guestCount")
    .populate("payments", "amount status method paidDate")
    .sort({ startDate: -1 })
    .limit(50);

  // Calculate comprehensive stats
  const totalSpentResult = await Event.aggregate([
    { $match: { clientId: client._id } },
    { $group: { _id: null, total: { $sum: "$pricing.totalAmount" } } },
  ]);

  const paymentStats = await Event.aggregate([
    { $match: { clientId: client._id } },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: "$pricing.totalAmount" },
        totalPaid: { $sum: "$paymentSummary.paidAmount" },
        upcomingEvents: {
          $sum: {
            $cond: [
              { $and: [{ $gt: ["$startDate", new Date()] }, { $ne: ["$status", "cancelled"] }] },
              1,
              0
            ]
          }
        }
      }
    }
  ]);

  const stats = paymentStats[0] || {
    totalRevenue: 0,
    totalPaid: 0,
    upcomingEvents: 0
  };

  // Get recent payments - FIXED: Now using the imported Payment model
  const recentPayments = await Payment.find({ 
    client: client._id,
    type: 'income'
  })
    .select("amount method status paidDate reference description")
    .sort({ paidDate: -1 })
    .limit(10);

  new ApiResponse({
    client: {
      ...client.toObject(),
      events: events,
      recentPayments: recentPayments,
      stats: {
        totalSpent: totalSpentResult[0]?.total || 0,
        totalRevenue: stats.totalRevenue,
        totalPaid: stats.totalPaid,
        upcomingEvents: stats.upcomingEvents,
        totalEvents: events.length,
        pendingAmount: stats.totalRevenue - stats.totalPaid
      }
    },
  }).send(res);
});
/**
 * @desc    Create new client
 * @route   POST /api/v1/clients
 * @access  Private (clients.create)
 */
export const createClient = asyncHandler(async (req, res) => {
  // Check if client with email already exists in this venue
  const existingClient = await Client.findOne({
    email: req.body.email,
    venueId: req.user.venueId,
  });

  if (existingClient) {
    throw new ApiError("Client with this email already exists", 400);
  }

  const client = await Client.create({
    ...req.body,
    venueId: req.user.venueId,
    createdBy: req.user._id,
  });

  new ApiResponse({ client }, "Client created successfully", 201).send(res);
});

/**
 * @desc    Update client
 * @route   PUT /api/v1/clients/:id
 * @access  Private (clients.update.all)
 */
export const updateClient = asyncHandler(async (req, res) => {
  const client = await Client.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  });

  if (!client) {
    throw new ApiError("Client not found", 404);
  }

  // Check if email is being changed and if it's already in use
  if (req.body.email && req.body.email !== client.email) {
    const existingClient = await Client.findOne({
      email: req.body.email,
      venueId: req.user.venueId,
      _id: { $ne: client._id },
    });

    if (existingClient) {
      throw new ApiError("Client with this email already exists", 400);
    }
  }

  Object.assign(client, req.body);
  await client.save();

  new ApiResponse({ client }, "Client updated successfully").send(res);
});

/**
 * @desc    Delete client
 * @route   DELETE /api/v1/clients/:id
 * @access  Private (clients.delete.all)
 */
export const deleteClient = asyncHandler(async (req, res) => {
  const client = await Client.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  });

  if (!client) {
    throw new ApiError("Client not found", 404);
  }

  // Check if client has any events
  const eventCount = await Event.countDocuments({ clientId: client._id });

  if (eventCount > 0) {
    throw new ApiError(
      `Cannot delete client with ${eventCount} associated event(s)`,
     400
    );
  }

await client.deleteOne();

  new ApiResponse(null, "Client deleted successfully").send(res);
});

/**
 * @desc    Get client statistics
 * @route   GET /api/v1/clients/stats
 * @access  Private
 */
export const getClientStats = asyncHandler(async (req, res) => {
  const venueId = req.user.venueId;

  const [totalClients, activeClients, inactiveClients] = await Promise.all([
    Client.countDocuments({ venueId }),
    Client.countDocuments({ venueId, status: "active" }),
    Client.countDocuments({ venueId, status: "inactive" }),
  ]);

  // Top clients by revenue
  const topClients = await Event.aggregate([
    { $match: { venueId } },
    {
      $group: {
        _id: "$clientId",
        totalRevenue: { $sum: "$pricing.totalAmount" },
        eventCount: { $sum: 1 },
      },
    },
    { $sort: { totalRevenue: -1 } },
    { $limit: 5 },
    {
      $lookup: {
        from: "clients",
        localField: "_id",
        foreignField: "_id",
        as: "client",
      },
    },
    { $unwind: "$client" },
    {
      $project: {
        _id: 1,
        name: "$client.name",
        email: "$client.email",
        totalRevenue: 1,
        eventCount: 1,
      },
    },
  ]);

  new ApiResponse({
    totalClients,
    activeClients,
    inactiveClients,
    topClients,
  }).send(res);
});