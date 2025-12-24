// src/controllers/clientController.js
const asyncHandler = require("../middleware/asyncHandler");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const { Client, Event, Payment } = require("../models/index");

/**
 * @desc    Get all clients
 * @route   GET /api/v1/clients
 * @access  Private
 */
exports.getClients = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    status,
    search,
    sortBy = "createdAt",
    order = "desc",
    includeArchived = false,
  } = req.query;

  // Use the business context attached by authMiddleware
  const businessId = req.business._id;

  // Build query
  const query = { businessId };

  if (status) query.status = status;

  // Handle archive filter
  if (includeArchived === "true" || includeArchived === true) {
    // Include all clients
  } else {
    query.isArchived = { $ne: true };
  }

  // Search by name, email, or phone
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
      .populate("archivedBy", "name email")
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit)),
    Client.countDocuments(query),
  ]);

  // Get event count for each client (excluding archived events)
  const clientsWithEventCount = await Promise.all(
    clients.map(async (client) => {
      const eventCount = await Event.countDocuments({ 
        clientId: client._id,
        isArchived: { $ne: true }
      });
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
exports.getClient = asyncHandler(async (req, res) => {
  const client = await Client.findOne({
    _id: req.params.id,
    businessId: req.business._id,
  })
    .populate("createdBy", "name email")
    .populate("archivedBy", "name email");

  if (!client) {
    throw new ApiError("Client not found", 404);
  }

  // ✅ Get client's events with payment information
  const events = await Event.find({ 
    clientId: client._id,
    isArchived: { $ne: true }
  })
    .select("title type startDate endDate status pricing paymentSummary guestCount paymentInfo")
    .populate("paymentInfo.transactions", "amount status method paidDate createdAt")
    .sort({ startDate: -1 })
    .limit(50);

  // Calculate comprehensive stats (excluding archived events)
  const totalSpentResult = await Event.aggregate([
    { $match: { 
      clientId: client._id,
      isArchived: { $ne: true }
    } },
    { $group: { _id: null, total: { $sum: "$pricing.totalAmount" } } },
  ]);

  const paymentStats = await Event.aggregate([
    { $match: { 
      clientId: client._id,
      isArchived: { $ne: true }
    } },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: "$pricing.totalAmount" },
        totalPaid: { $sum: "$paymentInfo.paidAmount" }, // Updated field path match new Schema
        upcomingEvents: {
          $sum: {
            $cond: [
              { 
                $and: [
                  { $gt: ["$startDate", new Date()] }, 
                  { $ne: ["$status", "cancelled"] }
                ] 
              },
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

  // Get recent payments
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
exports.createClient = asyncHandler(async (req, res) => {
  const businessId = req.business._id;

  // Check if client with email already exists in this business (excluding archived)
  const existingClient = await Client.findOne({
    email: req.body.email,
    businessId,
    isArchived: { $ne: true }
  });

  if (existingClient) {
    throw new ApiError("Client with this email already exists", 400);
  }

  const client = await Client.create({
    ...req.body,
    businessId,
    createdBy: req.user._id,
  });

  new ApiResponse({ client }, "Client created successfully", 201).send(res);
});

/**
 * @desc    Update client
 * @route   PUT /api/v1/clients/:id
 * @access  Private (clients.update.all)
 */
exports.updateClient = asyncHandler(async (req, res) => {
  const businessId = req.business._id;

  const client = await Client.findOne({
    _id: req.params.id,
    businessId,
    isArchived: { $ne: true }
  });

  if (!client) {
    throw new ApiError("Client not found", 404);
  }

  // Check if email is being changed and if it's already in use
  if (req.body.email && req.body.email !== client.email) {
    const existingClient = await Client.findOne({
      email: req.body.email,
      businessId,
      _id: { $ne: client._id },
      isArchived: { $ne: true }
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
 * @desc    Archive client (soft delete)
 * @route   DELETE /api/v1/clients/:id
 * @access  Private (clients.delete.all)
 */
exports.archiveClient = asyncHandler(async (req, res) => {
  const client = await Client.findOne({
    _id: req.params.id,
    businessId: req.business._id,
    isArchived: { $ne: true }
  });

  if (!client) {
    throw new ApiError("Client not found", 404);
  }

  // Archive the client instead of deleting
  const archivedClient = await Client.archiveClient(req.params.id, req.user._id);

  new ApiResponse({ client: archivedClient }, "Client archived successfully").send(res);
});

/**
 * @desc    Restore archived client
 * @route   PATCH /api/v1/clients/:id/restore
 * @access  Private (clients.delete.all)
 */
exports.restoreClient = asyncHandler(async (req, res) => {
  const client = await Client.findOne({
    _id: req.params.id,
    businessId: req.business._id,
    isArchived: true
  });

  if (!client) {
    throw new ApiError("Archived client not found", 404);
  }

  const restoredClient = await Client.restoreClient(req.params.id);

  new ApiResponse({ client: restoredClient }, "Client restored successfully").send(res);
});

/**
 * @desc    Get archived clients
 * @route   GET /api/v1/clients/archived
 * @access  Private (clients.read.all)
 */
exports.getArchivedClients = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search,
  } = req.query;

  // Build query for archived clients
  const query = { 
    businessId: req.business._id,
    isArchived: true 
  };

  // Search by name, email, or phone
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
    ];
  }

  // Pagination
  const skip = (page - 1) * limit;

  // Execute query
  const [clients, total] = await Promise.all([
    Client.find(query)
      .populate("createdBy", "name email")
      .populate("archivedBy", "name email")
      .sort({ archivedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Client.countDocuments(query),
  ]);

  new ApiResponse({
    clients,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit),
    },
  }).send(res);
});

/**
 * @desc    Get client statistics
 * @route   GET /api/v1/clients/stats
 * @access  Private
 */
exports.getClientStats = asyncHandler(async (req, res) => {
  const businessId = req.business._id;

  // Exclude archived clients from stats
  const [totalClients, activeClients, inactiveClients] = await Promise.all([
    Client.countDocuments({ businessId, isArchived: { $ne: true } }),
    Client.countDocuments({ businessId, status: "active", isArchived: { $ne: true } }),
    Client.countDocuments({ businessId, status: "inactive", isArchived: { $ne: true } }),
  ]);

  // Top clients by revenue (excluding archived events)
  const topClients = await Event.aggregate([
    { 
      $match: { 
        businessId,
        isArchived: { $ne: true }
      } 
    },
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
      $match: {
        "client.isArchived": { $ne: true }
      }
    },
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

  // Get new clients this month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const newClientsThisMonth = await Client.countDocuments({
    businessId,
    isArchived: { $ne: true },
    createdAt: { $gte: startOfMonth }
  });

  new ApiResponse({
    totalClients,
    activeClients,
    inactiveClients,
    newClientsThisMonth,
    topClients,
  }).send(res);
});