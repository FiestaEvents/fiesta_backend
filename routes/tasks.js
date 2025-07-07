import express from "express"
import Task from "../models/Task.js"
import { asyncHandler } from "../middleware/errorHandler.js"
import { checkPermission } from "../middleware/auth.js"

const router = express.Router()

// @desc    Get all tasks
// @route   GET /api/tasks
// @access  Private
router.get(
  "/",
  checkPermission("tasks", "view"),
  asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      priority,
      category,
      assignedTo,
      dueDate,
      sortBy = "dueDate",
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

    // Filter by priority
    if (priority) {
      query.priority = priority
    }

    // Filter by category
    if (category) {
      query.category = category
    }

    // Filter by assigned user
    if (assignedTo) {
      query.assignedTo = assignedTo
    }

    // Filter by due date
    if (dueDate) {
      const date = new Date(dueDate)
      const nextDay = new Date(date)
      nextDay.setDate(date.getDate() + 1)

      query.dueDate = {
        $gte: date,
        $lt: nextDay,
      }
    }

    const sortOptions = {}
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1

    const tasks = await Task.find(query)
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate("assignedTo", "name email")
      .populate("relatedEvent", "title type startDate")
      .populate("relatedClient", "name company")
      .populate("relatedPartner", "name company")
      .populate("createdBy", "name")

    const total = await Task.countDocuments(query)

    res.json({
      tasks,
      pagination: {
        current: Number.parseInt(page),
        pages: Math.ceil(total / limit),
        total,
        limit: Number.parseInt(limit),
      },
    })
  }),
)

// @desc    Get single task
// @route   GET /api/tasks/:id
// @access  Private
router.get(
  "/:id",
  checkPermission("tasks", "view"),
  asyncHandler(async (req, res) => {
    const task = await Task.findOne({
      _id: req.params.id,
      venueId: req.user.venueId,
    })
      .populate("assignedTo", "name email phone")
      .populate("relatedEvent")
      .populate("relatedClient")
      .populate("relatedPartner")
      .populate("createdBy", "name email")
      .populate("completedBy", "name email")
      .populate("comments.author", "name")
      .populate("subtasks.completedBy", "name")

    if (!task) {
      return res.status(404).json({ message: "Task not found" })
    }

    res.json({ task })
  }),
)

// @desc    Create new task
// @route   POST /api/tasks
// @access  Private
router.post(
  "/",
  checkPermission("tasks", "create"),
  asyncHandler(async (req, res) => {
    const taskData = {
      ...req.body,
      venueId: req.user.venueId,
      createdBy: req.user._id,
    }

    const task = new Task(taskData)
    await task.save()

    await task.populate("assignedTo", "name email")
    await task.populate("relatedEvent", "title")

    res.status(201).json({
      message: "Task created successfully",
      task,
    })
  }),
)

// @desc    Update task
// @route   PUT /api/tasks/:id
// @access  Private
router.put(
  "/:id",
  checkPermission("tasks", "edit"),
  asyncHandler(async (req, res) => {
    const task = await Task.findOne({
      _id: req.params.id,
      venueId: req.user.venueId,
    })

    if (!task) {
      return res.status(404).json({ message: "Task not found" })
    }

    // If status is being changed to completed, set completedBy and completedAt
    if (req.body.status === "completed" && task.status !== "completed") {
      req.body.completedBy = req.user._id
      req.body.completedAt = new Date()
    }

    Object.assign(task, req.body)
    await task.save()

    res.json({
      message: "Task updated successfully",
      task,
    })
  }),
)

// @desc    Delete task
// @route   DELETE /api/tasks/:id
// @access  Private
router.delete(
  "/:id",
  checkPermission("tasks", "delete"),
  asyncHandler(async (req, res) => {
    const task = await Task.findOne({
      _id: req.params.id,
      venueId: req.user.venueId,
    })

    if (!task) {
      return res.status(404).json({ message: "Task not found" })
    }

    await Task.findByIdAndDelete(task._id)

    res.json({ message: "Task deleted successfully" })
  }),
)

// @desc    Add comment to task
// @route   POST /api/tasks/:id/comments
// @access  Private
router.post(
  "/:id/comments",
  checkPermission("tasks", "view"),
  asyncHandler(async (req, res) => {
    const { text } = req.body

    const task = await Task.findOne({
      _id: req.params.id,
      venueId: req.user.venueId,
    })

    if (!task) {
      return res.status(404).json({ message: "Task not found" })
    }

    task.comments.push({
      text,
      author: req.user._id,
      createdAt: new Date(),
    })

    await task.save()
    await task.populate("comments.author", "name")

    res.json({
      message: "Comment added successfully",
      comment: task.comments[task.comments.length - 1],
    })
  }),
)

// @desc    Update subtask
// @route   PATCH /api/tasks/:id/subtasks/:subtaskId
// @access  Private
router.patch(
  "/:id/subtasks/:subtaskId",
  checkPermission("tasks", "edit"),
  asyncHandler(async (req, res) => {
    const { completed } = req.body

    const task = await Task.findOne({
      _id: req.params.id,
      venueId: req.user.venueId,
    })

    if (!task) {
      return res.status(404).json({ message: "Task not found" })
    }

    const subtask = task.subtasks.id(req.params.subtaskId)
    if (!subtask) {
      return res.status(404).json({ message: "Subtask not found" })
    }

    subtask.completed = completed
    if (completed) {
      subtask.completedAt = new Date()
      subtask.completedBy = req.user._id
    } else {
      subtask.completedAt = undefined
      subtask.completedBy = undefined
    }

    await task.save()

    res.json({
      message: "Subtask updated successfully",
      subtask,
    })
  }),
)

// @desc    Get task statistics
// @route   GET /api/tasks/stats/overview
// @access  Private
router.get(
  "/stats/overview",
  checkPermission("tasks", "view"),
  asyncHandler(async (req, res) => {
    const venueId = req.user.venueId

    const stats = await Task.aggregate([
      { $match: { venueId } },
      {
        $group: {
          _id: null,
          totalTasks: { $sum: 1 },
          todoTasks: { $sum: { $cond: [{ $eq: ["$status", "todo"] }, 1, 0] } },
          inProgressTasks: { $sum: { $cond: [{ $eq: ["$status", "in-progress"] }, 1, 0] } },
          completedTasks: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
          overdueTasks: {
            $sum: {
              $cond: [
                {
                  $and: [{ $ne: ["$status", "completed"] }, { $lt: ["$dueDate", new Date()] }],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ])

    const tasksByPriority = await Task.aggregate([
      { $match: { venueId } },
      {
        $group: {
          _id: "$priority",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ])

    const tasksByCategory = await Task.aggregate([
      { $match: { venueId } },
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ])

    res.json({
      overview: stats[0] || {
        totalTasks: 0,
        todoTasks: 0,
        inProgressTasks: 0,
        completedTasks: 0,
        overdueTasks: 0,
      },
      tasksByPriority,
      tasksByCategory,
    })
  }),
)

export default router
