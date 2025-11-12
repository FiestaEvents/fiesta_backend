import asyncHandler from "../middleware/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { Event, Client, Partner } from "../models/index.js";

/**
 * @desc    Get all events
 * @route   GET /api/v1/events
 * @access  Private
 */
export const getEvents = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    status,
    type,
    clientId,
    startDate,
    endDate,
    search,
    includeArchived = false,
  } = req.query;

  // Build query
  const query = { venueId: req.user.venueId };

  if (status) query.status = status;
  if (type) query.type = type;
  if (clientId) query.clientId = clientId;

  // Date range filter
  if (startDate || endDate) {
    query.startDate = {};
    if (startDate) query.startDate.$gte = new Date(startDate);
    if (endDate) query.startDate.$lte = new Date(endDate);
  }

  // Search by title
  if (search) {
    query.title = { $regex: search, $options: "i" };
  }

  // Handle archive filter
  if (includeArchived === "true" || includeArchived === true) {
    // Include all events
  } else {
    query.isArchived = { $ne: true };
  }

  // Pagination
  const skip = (page - 1) * limit;

  // Execute query
  const [events, total] = await Promise.all([
    Event.find(query)
      .populate("clientId", "name email phone")
      .populate("partners.partner", "name category")
      .populate("createdBy", "name email")
      .populate("archivedBy", "name email")
      .sort({ startDate: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Event.countDocuments(query),
  ]);

  new ApiResponse({
    events,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit),
    },
  }).send(res);
});

/**
 * @desc    Get events by client ID
 * @route   GET /api/v1/events/client/:clientId
 * @access  Private
 */
export const getEventsByClient = asyncHandler(async (req, res) => {
  const { clientId } = req.params;
  const {
    page = 1,
    limit = 50,
    status,
    sortBy = "startDate",
    order = "desc",
    includeArchived = false,
  } = req.query;

  // Verify client exists and belongs to venue
  const client = await Client.findOne({
    _id: clientId,
    venueId: req.user.venueId,
  });

  if (!client) {
    throw new ApiError("Client not found", 404);
  }

  // Build query
  const query = {
    clientId: clientId,
    venueId: req.user.venueId,
  };

  if (status) query.status = status;

  // Handle archive filter
  if (includeArchived === "true" || includeArchived === true) {
    // Include all events
  } else {
    query.isArchived = { $ne: true };
  }

  // Pagination
  const skip = (page - 1) * limit;

  // Sort
  const sortOrder = order === "asc" ? 1 : -1;
  const sortOptions = { [sortBy]: sortOrder };

  // Execute query
  const [events, total] = await Promise.all([
    Event.find(query)
      .populate("clientId", "name email phone")
      .populate("partners.partner", "name category")
      .populate("createdBy", "name email")
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit)),
    Event.countDocuments(query),
  ]);

  // Calculate statistics for this client (excluding archived events)
  const statsQuery = { ...query, isArchived: { $ne: true } };
  const stats = await Event.aggregate([
    { $match: statsQuery },
    {
      $group: {
        _id: null,
        totalEvents: { $sum: 1 },
        totalRevenue: { $sum: "$pricing.totalAmount" },
        totalPaid: { $sum: "$paymentSummary.paidAmount" },
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

  const clientStats = stats[0] || {
    totalEvents: 0,
    totalRevenue: 0,
    totalPaid: 0,
    upcomingEvents: 0
  };

  new ApiResponse({
    events,
    client: {
      _id: client._id,
      name: client.name,
      email: client.email,
      phone: client.phone,
    },
    stats: {
      ...clientStats,
      pendingAmount: clientStats.totalRevenue - clientStats.totalPaid
    },
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit),
    },
  }).send(res);
});

/**
 * @desc    Get single event
 * @route   GET /api/v1/events/:id
 * @access  Private
 */
export const getEvent = asyncHandler(async (req, res) => {
  const event = await Event.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  })
    .populate("clientId")
    .populate("partners.partner")
    .populate("payments")
    .populate("createdBy", "name email")
    .populate("archivedBy", "name email");

  if (!event) {
    throw new ApiError("Event not found", 404);
  }

  new ApiResponse({ event }).send(res);
});

/**
 * @desc    Create new event
 * @route   POST /api/v1/events
 * @access  Private (events.create)
 */
export const createEvent = asyncHandler(async (req, res) => {
  const eventData = {
    ...req.body,
    venueId: req.user.venueId,
    createdBy: req.user._id,
  };

  // Verify client exists and belongs to venue
  const client = await Client.findOne({
    _id: eventData.clientId,
    venueId: req.user.venueId,
  });

  if (!client) {
    throw new ApiError("Client not found", 404);
  }

  // Check for date conflicts (excluding archived events)
  const conflictingEvent = await Event.findOne({
    venueId: req.user.venueId,
    status: { $nin: ["cancelled", "completed"] },
    isArchived: { $ne: true },
    $or: [
      {
        startDate: {
          $lte: new Date(eventData.endDate),
        },
        endDate: {
          $gte: new Date(eventData.startDate),
        },
      },
    ],
  });

  if (conflictingEvent) {
    throw new ApiError(
      "This time slot conflicts with another event",
      400
    );
  }

  const event = await Event.create(eventData);

  await event.populate("clientId", "name email phone");

  new ApiResponse({ event }, "Event created successfully", 201).send(res);
});

/**
 * @desc    Update event
 * @route   PUT /api/v1/events/:id
 * @access  Private (events.update.all or events.update.own)
 */
export const updateEvent = asyncHandler(async (req, res) => {
  let event = await Event.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
    isArchived: { $ne: true }
  });

  if (!event) {
    throw new ApiError("Event not found", 404);
  }

  // Check ownership for "own" scope
  const hasAllPermission = await req.user.hasPermission("events.update.all");
  if (!hasAllPermission && event.createdBy.toString() !== req.user._id.toString()) {
    throw new ApiError("You can only update your own events", 403);
  }

  // Check date conflicts if dates are being updated (excluding archived events)
  if (req.body.startDate || req.body.endDate) {
    const startDate = req.body.startDate
      ? new Date(req.body.startDate)
      : event.startDate;
    const endDate = req.body.endDate ? new Date(req.body.endDate) : event.endDate;

    const conflictingEvent = await Event.findOne({
      _id: { $ne: event._id },
      venueId: req.user.venueId,
      status: { $nin: ["cancelled", "completed"] },
      isArchived: { $ne: true },
      $or: [
        {
          startDate: { $lte: endDate },
          endDate: { $gte: startDate },
        },
      ],
    });

    if (conflictingEvent) {
      throw new ApiError(
        "This time slot conflicts with another event",
        400
      );
    }
  }

  // Update event
  Object.assign(event, req.body);
  await event.save();

  await event.populate("clientId", "name email phone");

  new ApiResponse({ event }, "Event updated successfully").send(res);
});

/**
 * @desc    Archive event (soft delete)
 * @route   DELETE /api/v1/events/:id
 * @access  Private (events.delete.all)
 */
export const archiveEvent = asyncHandler(async (req, res) => {
  const event = await Event.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
    isArchived: { $ne: true }
  });

  if (!event) {
    throw new ApiError("Event not found", 404);
  }

  // Archive the event instead of deleting
  const archivedEvent = await Event.archiveEvent(req.params.id, req.user._id);

  new ApiResponse({ event: archivedEvent }, "Event archived successfully").send(res);
});

/**
 * @desc    Restore archived event
 * @route   PATCH /api/v1/events/:id/restore
 * @access  Private (events.delete.all)
 */
export const restoreEvent = asyncHandler(async (req, res) => {
  const event = await Event.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
    isArchived: true
  });

  if (!event) {
    throw new ApiError("Archived event not found", 404);
  }

  const restoredEvent = await Event.restoreEvent(req.params.id);

  new ApiResponse({ event: restoredEvent }, "Event restored successfully").send(res);
});

/**
 * @desc    Get archived events
 * @route   GET /api/v1/events/archived
 * @access  Private (events.read.all)
 */
export const getArchivedEvents = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search,
  } = req.query;

  // Build query for archived events
  const query = { 
    venueId: req.user.venueId,
    isArchived: true 
  };

  // Search by title
  if (search) {
    query.title = { $regex: search, $options: "i" };
  }

  // Pagination
  const skip = (page - 1) * limit;

  // Execute query
  const [events, total] = await Promise.all([
    Event.find(query)
      .populate("clientId", "name email phone")
      .populate("partners.partner", "name category")
      .populate("createdBy", "name email")
      .populate("archivedBy", "name email")
      .sort({ archivedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Event.countDocuments(query),
  ]);

  new ApiResponse({
    events,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit),
    },
  }).send(res);
});

/**
 * @desc    Get event statistics
 * @route   GET /api/v1/events/stats
 * @access  Private
 */
export const getEventStats = asyncHandler(async (req, res) => {
  const venueId = req.user.venueId;

  // Exclude archived events from stats
  const stats = await Event.aggregate([
    { $match: { venueId, isArchived: { $ne: true } } },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalRevenue: { $sum: "$pricing.totalAmount" },
      },
    },
  ]);

  const typeStats = await Event.aggregate([
    { $match: { venueId, isArchived: { $ne: true } } },
    {
      $group: {
        _id: "$type",
        count: { $sum: 1 },
      },
    },
  ]);

  // Get total events count
  const totalEvents = await Event.countDocuments({ 
    venueId, 
    isArchived: { $ne: true } 
  });

  // Get upcoming events count
  const upcomingEvents = await Event.countDocuments({
    venueId,
    isArchived: { $ne: true },
    startDate: { $gte: new Date() },
    status: { $in: ["pending", "confirmed"] }
  });

  new ApiResponse({
    statusStats: stats,
    typeStats,
    summary: {
      totalEvents,
      upcomingEvents
    }
  }).send(res);
});