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

  // Pagination
  const skip = (page - 1) * limit;

  // Execute query
  const [events, total] = await Promise.all([
    Event.find(query)
      .populate("clientId", "name email phone")
      .populate("partners.partner", "name category")
      .populate("createdBy", "name email")
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
    .populate("createdBy", "name email");

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

  // Check for date conflicts
  const conflictingEvent = await Event.findOne({
    venueId: req.user.venueId,
    status: { $nin: ["cancelled", "completed"] },
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
  });

  if (!event) {
    throw new ApiError("Event not found", 404);
  }

  // Check ownership for "own" scope
  const hasAllPermission = await req.user.hasPermission("events.update.all");
  if (!hasAllPermission && event.createdBy.toString() !== req.user._id.toString()) {
    throw new ApiError("You can only update your own events", 403);
  }

  // Check date conflicts if dates are being updated
  if (req.body.startDate || req.body.endDate) {
    const startDate = req.body.startDate
      ? new Date(req.body.startDate)
      : event.startDate;
    const endDate = req.body.endDate ? new Date(req.body.endDate) : event.endDate;

    const conflictingEvent = await Event.findOne({
      _id: { $ne: event._id },
      venueId: req.user.venueId,
      status: { $nin: ["cancelled", "completed"] },
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
 * @desc    Delete event
 * @route   DELETE /api/v1/events/:id
 * @access  Private (events.delete.all)
 */
export const deleteEvent = asyncHandler(async (req, res) => {
  const event = await Event.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  });

  if (!event) {
    throw new ApiError("Event not found", 404);
  }

  await event.deleteOne();

  new ApiResponse(null, "Event deleted successfully").send(res);
});

/**
 * @desc    Get event statistics
 * @route   GET /api/v1/events/stats
 * @access  Private
 */
export const getEventStats = asyncHandler(async (req, res) => {
  const venueId = req.user.venueId;

  const stats = await Event.aggregate([
    { $match: { venueId } },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalRevenue: { $sum: "$pricing.totalAmount" },
      },
    },
  ]);

  const typeStats = await Event.aggregate([
    { $match: { venueId } },
    {
      $group: {
        _id: "$type",
        count: { $sum: 1 },
      },
    },
  ]);

  new ApiResponse({
    statusStats: stats,
    typeStats,
  }).send(res);
});