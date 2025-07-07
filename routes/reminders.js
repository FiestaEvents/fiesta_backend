import express from "express"
import Reminder from "../models/Reminder.js"
import { asyncHandler } from "../middleware/errorHandler.js"
import { checkPermission } from "../middleware/auth.js"

const router = express.Router()

// @desc    Get all reminders
// @route   GET /api/reminders
// @access  Private
router.get(
  "/",
  checkPermission("reminders", "view"),
  asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      type,
      priority,
      assignedTo,
      reminderDate,
      sortBy = "reminderDate",
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

    // Filter by priority
    if (priority) {
      query.priority = priority
    }

    // Filter by assigned user
    if (assignedTo) {
      query.assignedTo = { $in: [assignedTo] }
    }

    // Filter by reminder date
    if (reminderDate) {
      const date = new Date(reminderDate)
      const nextDay = new Date(date)
      nextDay.setDate(date.getDate() + 1)

      query.reminderDate = {
        $gte: date,
        $lt: nextDay,
      }
    }

    const sortOptions = {}
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1

    const reminders = await Reminder.find(query)
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate("assignedTo", "name email")
      .populate("relatedEvent", "title type startDate")
      .populate("relatedClient", "name company")
      .populate("relatedTask", "title status")
      .populate("relatedPayment", "amount status")
      .populate("createdBy", "name")

    const total = await Reminder.countDocuments(query)

    res.json({
      reminders,
      pagination: {
        current: Number.parseInt(page),
        pages: Math.ceil(total / limit),
        total,
        limit: Number.parseInt(limit),
      },
    })
  }),
)

// @desc    Get single reminder
// @route   GET /api/reminders/:id
// @access  Private
router.get(
  "/:id",
  checkPermission("reminders", "view"),
  asyncHandler(async (req, res) => {
    const reminder = await Reminder.findOne({
      _id: req.params.id,
      venueId: req.user.venueId,
    })
      .populate("assignedTo", "name email phone")
      .populate("relatedEvent")
      .populate("relatedClient")
      .populate("relatedTask")
      .populate("relatedPayment")
      .populate("createdBy", "name email")
      .populate("completedBy", "name email")

    if (!reminder) {
      return res.status(404).json({ message: "Reminder not found" })
    }

    res.json({ reminder })
  }),
)

// @desc    Create new reminder
// @route   POST /api/reminders
// @access  Private
router.post(
  "/",
  checkPermission("reminders", "create"),
  asyncHandler(async (req, res) => {
    const reminderData = {
      ...req.body,
      venueId: req.user.venueId,
      createdBy: req.user._id,
    }

    const reminder = new Reminder(reminderData)
    await reminder.save()

    await reminder.populate("assignedTo", "name email")
    await reminder.populate("relatedEvent", "title")

    res.status(201).json({
      message: "Reminder created successfully",
      reminder,
    })
  }),
)

// @desc    Update reminder
// @route   PUT /api/reminders/:id
// @access  Private
router.put(
  "/:id",
  checkPermission("reminders", "edit"),
  asyncHandler(async (req, res) => {
    const reminder = await Reminder.findOne({
      _id: req.params.id,
      venueId: req.user.venueId,
    })

    if (!reminder) {
      return res.status(404).json({ message: "Reminder not found" })
    }

    // If status is being changed to completed, set completedBy and completedAt
    if (req.body.status === "completed" && reminder.status !== "completed") {
      req.body.completedBy = req.user._id
      req.body.completedAt = new Date()
    }

    Object.assign(reminder, req.body)
    await reminder.save()

    res.json({
      message: "Reminder updated successfully",
      reminder,
    })
  }),
)

// @desc    Delete reminder
// @route   DELETE /api/reminders/:id
// @access  Private
router.delete(
  "/:id",
  checkPermission("reminders", "delete"),
  asyncHandler(async (req, res) => {
    const reminder = await Reminder.findOne({
      _id: req.params.id,
      venueId: req.user.venueId,
    })

    if (!reminder) {
      return res.status(404).json({ message: "Reminder not found" })
    }

    await Reminder.findByIdAndDelete(reminder._id)

    res.json({ message: "Reminder deleted successfully" })
  }),
)

// @desc    Snooze reminder
// @route   PATCH /api/reminders/:id/snooze
// @access  Private
router.patch(
  "/:id/snooze",
  checkPermission("reminders", "edit"),
  asyncHandler(async (req, res) => {
    const { snoozeUntil } = req.body

    const reminder = await Reminder.findOne({
      _id: req.params.id,
      venueId: req.user.venueId,
    })

    if (!reminder) {
      return res.status(404).json({ message: "Reminder not found" })
    }

    reminder.status = "snoozed"
    reminder.snoozeUntil = new Date(snoozeUntil)
    await reminder.save()

    res.json({
      message: "Reminder snoozed successfully",
      reminder: { id: reminder._id, status: reminder.status, snoozeUntil: reminder.snoozeUntil },
    })
  }),
)

// @desc    Get upcoming reminders
// @route   GET /api/reminders/upcoming
// @access  Private
router.get(
  "/upcoming/today",
  checkPermission("reminders", "view"),
  asyncHandler(async (req, res) => {
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)

    const upcomingReminders = await Reminder.find({
      venueId: req.user.venueId,
      status: "active",
      reminderDate: {
        $gte: today,
        $lt: tomorrow,
      },
    })
      .sort({ reminderDate: 1 })
      .populate("assignedTo", "name")
      .populate("relatedEvent", "title startDate")
      .limit(10)

    res.json({ reminders: upcomingReminders })
  }),
)

// @desc    Get reminder statistics
// @route   GET /api/reminders/stats/overview
// @access  Private
router.get(
  "/stats/overview",
  checkPermission("reminders", "view"),
  asyncHandler(async (req, res) => {
    const venueId = req.user.venueId

    const stats = await Reminder.aggregate([
      { $match: { venueId } },
      {
        $group: {
          _id: null,
          totalReminders: { $sum: 1 },
          activeReminders: { $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] } },
          completedReminders: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
          snoozedReminders: { $sum: { $cond: [{ $eq: ["$status", "snoozed"] }, 1, 0] } },
          overdueReminders: {
            $sum: {
              $cond: [
                {
                  $and: [{ $eq: ["$status", "active"] }, { $lt: ["$reminderDate", new Date()] }],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ])

    const remindersByType = await Reminder.aggregate([
      { $match: { venueId } },
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ])

    const remindersByPriority = await Reminder.aggregate([
      { $match: { venueId } },
      {
        $group: {
          _id: "$priority",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ])

    res.json({
      overview: stats[0] || {
        totalReminders: 0,
        activeReminders: 0,
        completedReminders: 0,
        snoozedReminders: 0,
        overdueReminders: 0,
      },
      remindersByType,
      remindersByPriority,
    })
  }),
)

export default router
