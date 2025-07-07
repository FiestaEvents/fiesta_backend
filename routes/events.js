import express from "express"
import Event from "../models/Event.js"
import Client from "../models/Client.js"
import { asyncHandler } from "../middleware/errorHandler.js"
import { checkPermission } from "../middleware/auth.js"

const router = express.Router()

// @desc    Get all events
// @route   GET /api/events
// @access  Private
router.get(
  "/",
  checkPermission("events", "view"),
  asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      type,
      startDate,
      endDate,
      sortBy = "startDate",
      sortOrder = "asc",
    } = req.query

    const query = { venueId: req.user.venueId }

    // Search functionality
    if (search) {
      query.$or = [{ title: { $regex: search, $options: "i" } }, { description: { $regex: search, $options: "i" } }]
    }

    // Filter by status
    if (status) {
      query.status = status
    }

    // Filter by type
    if (type) {
      query.type = type
    }

    // Date range filter
    if (startDate || endDate) {
      query.startDate = {}
      if (startDate) query.startDate.$gte = new Date(startDate)
      if (endDate) query.startDate.$lte = new Date(endDate)
    }

    const sortOptions = {}
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1

    const events = await Event.find(query)
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate("client", "name email phone company")
      .populate("partners.partner", "name company category")

    const total = await Event.countDocuments(query)

    res.json({
      events,
      pagination: {
        current: Number.parseInt(page),
        pages: Math.ceil(total / limit),
        total,
        limit: Number.parseInt(limit),
      },
    })
  }),
)

// @desc    Get calendar events
// @route   GET /api/events/calendar
// @access  Private
router.get(
  "/calendar",
  checkPermission("events", "view"),
  asyncHandler(async (req, res) => {
    const { month, year } = req.query

    const dateFilter = { venueId: req.user.venueId }

    if (month && year) {
      const startDate = new Date(year, month - 1, 1)
      const endDate = new Date(year, month, 0, 23, 59, 59)

      dateFilter.startDate = {
        $gte: startDate,
        $lte: endDate,
      }
    }

    const events = await Event.find(dateFilter)
      .select("title type startDate endDate startTime endTime status client pricing.totalAmount")
      .populate("client", "name")
      .sort({ startDate: 1 })

    res.json({ events })
  }),
)

// @desc    Get single event
// @route   GET /api/events/:id
// @access  Private
router.get(
  "/:id",
  checkPermission("events", "view"),
  asyncHandler(async (req, res) => {
    const event = await Event.findOne({
      _id: req.params.id,
      venueId: req.user.venueId,
    })
      .populate("client")
      .populate("partners.partner")
      .populate("createdBy", "name email")

    if (!event) {
      return res.status(404).json({ message: "Event not found" })
    }

    res.json({ event })
  }),
)

// @desc    Create new event
// @route   POST /api/events
// @access  Private
router.post(
  "/",
  checkPermission("events", "create"),
  asyncHandler(async (req, res) => {
    const eventData = {
      ...req.body,
      venueId: req.user.venueId,
      createdBy: req.user._id,
    }

    // Check for date conflicts
    const conflictingEvent = await Event.findOne({
      venueId: req.user.venueId,
      $or: [
        {
          startDate: { $lte: new Date(eventData.endDate) },
          endDate: { $gte: new Date(eventData.startDate) },
        },
      ],
      status: { $nin: ["cancelled", "completed"] },
    })

    if (conflictingEvent) {
      return res.status(400).json({
        message: "Date conflict with existing event",
        conflictingEvent: {
          id: conflictingEvent._id,
          title: conflictingEvent.title,
          startDate: conflictingEvent.startDate,
          endDate: conflictingEvent.endDate,
        },
      })
    }

    const event = new Event(eventData)
    await event.save()

    // Update client's event history and total spent
    if (eventData.client) {
      await Client.findByIdAndUpdate(eventData.client, {
        $push: {
          eventHistory: {
            eventId: event._id,
            eventDate: event.startDate,
            eventType: event.type,
            amount: event.pricing.totalAmount,
          },
        },
        $inc: { totalSpent: event.pricing.totalAmount },
      })
    }

    await event.populate("client", "name email phone")

    res.status(201).json({
      message: "Event created successfully",
      event,
    })
  }),
)

// @desc    Update event
// @route   PUT /api/events/:id
// @access  Private
router.put(
  "/:id",
  checkPermission("events", "edit"),
  asyncHandler(async (req, res) => {
    const event = await Event.findOne({
      _id: req.params.id,
      venueId: req.user.venueId,
    })

    if (!event) {
      return res.status(404).json({ message: "Event not found" })
    }

    // If dates are being changed, check for conflicts
    if (req.body.startDate || req.body.endDate) {
      const startDate = req.body.startDate ? new Date(req.body.startDate) : event.startDate
      const endDate = req.body.endDate ? new Date(req.body.endDate) : event.endDate

      const conflictingEvent = await Event.findOne({
        _id: { $ne: event._id },
        venueId: req.user.venueId,
        $or: [
          {
            startDate: { $lte: endDate },
            endDate: { $gte: startDate },
          },
        ],
        status: { $nin: ["cancelled", "completed"] },
      })

      if (conflictingEvent) {
        return res.status(400).json({
          message: "Date conflict with existing event",
          conflictingEvent: {
            id: conflictingEvent._id,
            title: conflictingEvent.title,
            startDate: conflictingEvent.startDate,
            endDate: conflictingEvent.endDate,
          },
        })
      }
    }

    const oldAmount = event.pricing.totalAmount
    Object.assign(event, req.body)
    await event.save()

    // Update client's total spent if amount changed
    if (event.client && oldAmount !== event.pricing.totalAmount) {
      const difference = event.pricing.totalAmount - oldAmount
      await Client.findByIdAndUpdate(event.client, {
        $inc: { totalSpent: difference },
      })
    }

    await event.populate("client", "name email phone")

    res.json({
      message: "Event updated successfully",
      event,
    })
  }),
)

// @desc    Delete event
// @route   DELETE /api/events/:id
// @access  Private
router.delete(
  "/:id",
  checkPermission("events", "delete"),
  asyncHandler(async (req, res) => {
    const event = await Event.findOne({
      _id: req.params.id,
      venueId: req.user.venueId,
    })

    if (!event) {
      return res.status(404).json({ message: "Event not found" })
    }

    // Update client's total spent
    if (event.client) {
      await Client.findByIdAndUpdate(event.client, {
        $inc: { totalSpent: -event.pricing.totalAmount },
        $pull: { eventHistory: { eventId: event._id } },
      })
    }

    await Event.findByIdAndDelete(event._id)

    res.json({ message: "Event deleted successfully" })
  }),
)

// @desc    Update event status
// @route   PATCH /api/events/:id/status
// @access  Private
router.patch(
  "/:id/status",
  checkPermission("events", "edit"),
  asyncHandler(async (req, res) => {
    const { status } = req.body

    const event = await Event.findOne({
      _id: req.params.id,
      venueId: req.user.venueId,
    })

    if (!event) {
      return res.status(404).json({ message: "Event not found" })
    }

    event.status = status
    await event.save()

    res.json({
      message: "Event status updated successfully",
      event: { id: event._id, status: event.status },
    })
  }),
)

// @desc    Get event statistics
// @route   GET /api/events/stats/overview
// @access  Private
router.get(
  "/stats/overview",
  checkPermission("events", "view"),
  asyncHandler(async (req, res) => {
    const venueId = req.user.venueId

    const stats = await Event.aggregate([
      { $match: { venueId } },
      {
        $group: {
          _id: null,
          totalEvents: { $sum: 1 },
          pendingEvents: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
          confirmedEvents: { $sum: { $cond: [{ $eq: ["$status", "confirmed"] }, 1, 0] } },
          completedEvents: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
          totalRevenue: { $sum: "$pricing.totalAmount" },
          averageEventValue: { $avg: "$pricing.totalAmount" },
        },
      },
    ])

    const eventsByMonth = await Event.aggregate([
      { $match: { venueId } },
      {
        $group: {
          _id: {
            year: { $year: "$startDate" },
            month: { $month: "$startDate" },
          },
          count: { $sum: 1 },
          revenue: { $sum: "$pricing.totalAmount" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
      { $limit: 12 },
    ])

    const eventsByType = await Event.aggregate([
      { $match: { venueId } },
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
          revenue: { $sum: "$pricing.totalAmount" },
        },
      },
      { $sort: { count: -1 } },
    ])

    res.json({
      overview: stats[0] || {
        totalEvents: 0,
        pendingEvents: 0,
        confirmedEvents: 0,
        completedEvents: 0,
        totalRevenue: 0,
        averageEventValue: 0,
      },
      eventsByMonth,
      eventsByType,
    })
  }),
)

export default router
