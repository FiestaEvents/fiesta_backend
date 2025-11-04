import asyncHandler from "../middleware/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { Task, Event, Client, Partner, User } from "../models/index.js";

/**
 * @desc    Get all tasks
 * @route   GET /api/v1/tasks
 * @access  Private
 */
export const getTasks = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    status,
    priority,
    category,
    assignedTo,
    dueDateStart,
    dueDateEnd,
    search,
  } = req.query;

  // Build query
  const query = { venueId: req.user.venueId };

  if (status) query.status = status;
  if (priority) query.priority = priority;
  if (category) query.category = category;
  if (assignedTo) query.assignedTo = assignedTo;

  // Due date range filter
  if (dueDateStart || dueDateEnd) {
    query.dueDate = {};
    if (dueDateStart) query.dueDate.$gte = new Date(dueDateStart);
    if (dueDateEnd) query.dueDate.$lte = new Date(dueDateEnd);
  }

  // Search by title
  if (search) {
    query.title = { $regex: search, $options: "i" };
  }

  // Check permissions - if user only has read.own, filter by assignedTo
  const hasAllPermission = await req.user.hasPermission("tasks.read.all");
  if (!hasAllPermission) {
    query.assignedTo = req.user._id;
  }

  // Pagination
  const skip = (page - 1) * limit;

  // Execute query
  const [tasks, total] = await Promise.all([
    Task.find(query)
      .populate("assignedTo", "name email avatar")
      .populate("relatedEvent", "title startDate")
      .populate("relatedClient", "name email")
      .populate("relatedPartner", "name category")
      .populate("createdBy", "name email")
      .sort({ dueDate: 1, priority: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Task.countDocuments(query),
  ]);

  new ApiResponse({
    tasks,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit),
    },
  }).send(res);
});

/**
 * @desc    Get single task
 * @route   GET /api/v1/tasks/:id
 * @access  Private
 */
export const getTask = asyncHandler(async (req, res) => {
  const task = await Task.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  })
    .populate("assignedTo", "name email avatar")
    .populate("relatedEvent")
    .populate("relatedClient")
    .populate("relatedPartner")
    .populate("createdBy", "name email")
    .populate("comments.author", "name email avatar")
    .populate("subtasks.completedBy", "name email");

  if (!task) {
    throw new ApiError("Task not found", 404);
  }

  // Check ownership if user only has read.own permission
  const hasAllPermission = await req.user.hasPermission("tasks.read.all");
  if (
    !hasAllPermission &&
    task.assignedTo?._id.toString() !== req.user._id.toString()
  ) {
    throw new ApiError("You can only view your assigned tasks", 403);
  }

  new ApiResponse({ task }).send(res);
});

/**
 * @desc    Create new task
 * @route   POST /api/v1/tasks
 * @access  Private (tasks.create)
 */
export const createTask = asyncHandler(async (req, res) => {
  const taskData = {
    ...req.body,
    venueId: req.user.venueId,
    createdBy: req.user._id,
  };

  // Verify assignee exists and belongs to venue
  if (taskData.assignedTo) {
    const assignee = await User.findOne({
      _id: taskData.assignedTo,
      venueId: req.user.venueId,
      isActive: true,
    });

    if (!assignee) {
      throw new ApiError("Assigned user not found or inactive", 404);
    }
  }

  // Verify related resources if provided
  if (taskData.relatedEvent) {
    const event = await Event.findOne({
      _id: taskData.relatedEvent,
      venueId: req.user.venueId,
    });
    if (!event) throw new ApiError("Related event not found", 404);
  }

  if (taskData.relatedClient) {
    const client = await Client.findOne({
      _id: taskData.relatedClient,
      venueId: req.user.venueId,
    });
    if (!client) throw new ApiError("Related client not found", 404);
  }

  if (taskData.relatedPartner) {
    const partner = await Partner.findOne({
      _id: taskData.relatedPartner,
      venueId: req.user.venueId,
    });
    if (!partner) throw new ApiError("Related partner not found", 404);
  }

  const task = await Task.create(taskData);

  await task.populate([
    { path: "assignedTo", select: "name email avatar" },
    { path: "relatedEvent", select: "title startDate" },
    { path: "relatedClient", select: "name email" },
    { path: "relatedPartner", select: "name category" },
  ]);

  new ApiResponse({ task }, "Task created successfully", 201).send(res);
});

/**
 * @desc    Update task
 * @route   PUT /api/v1/tasks/:id
 * @access  Private (tasks.update.all or tasks.update.own)
 */
export const updateTask = asyncHandler(async (req, res) => {
  const task = await Task.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  });

  if (!task) {
    throw new ApiError("Task not found", 404);
  }

  // Check ownership for "own" scope
  const hasAllPermission = await req.user.hasPermission("tasks.update.all");
  if (
    !hasAllPermission &&
    task.assignedTo?.toString() !== req.user._id.toString()
  ) {
    throw new ApiError("You can only update your assigned tasks", 403);
  }

  // Verify new assignee if being changed
  if (req.body.assignedTo && req.body.assignedTo !== task.assignedTo?.toString()) {
    const assignee = await User.findOne({
      _id: req.body.assignedTo,
      venueId: req.user.venueId,
      isActive: true,
    });

    if (!assignee) {
      throw new ApiError("Assigned user not found or inactive", 404);
    }
  }

  // If status is being changed to completed, set completedAt and completedBy
  if (req.body.status === "completed" && task.status !== "completed") {
    req.body.completedAt = new Date();
    req.body.completedBy = req.user._id;
  }

  // If status is being changed from completed to something else, clear completion data
  if (req.body.status && req.body.status !== "completed" && task.status === "completed") {
    req.body.completedAt = undefined;
    req.body.completedBy = undefined;
  }

  Object.assign(task, req.body);
  await task.save();

  await task.populate([
    { path: "assignedTo", select: "name email avatar" },
    { path: "relatedEvent", select: "title startDate" },
    { path: "relatedClient", select: "name email" },
    { path: "relatedPartner", select: "name category" },
    { path: "completedBy", select: "name email" },
  ]);

  new ApiResponse({ task }, "Task updated successfully").send(res);
});

/**
 * @desc    Delete task
 * @route   DELETE /api/v1/tasks/:id
 * @access  Private (tasks.delete.all)
 */
export const deleteTask = asyncHandler(async (req, res) => {
  const task = await Task.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  });

  if (!task) {
    throw new ApiError("Task not found", 404);
  }

  await task.deleteOne();

  new ApiResponse(null, "Task deleted successfully").send(res);
});

/**
 * @desc    Add comment to task
 * @route   POST /api/v1/tasks/:id/comments
 * @access  Private
 */
export const addComment = asyncHandler(async (req, res) => {
  const { text } = req.body;

  const task = await Task.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  });

  if (!task) {
    throw new ApiError("Task not found", 404);
  }

  // Check if user can access this task
  const hasAllPermission = await req.user.hasPermission("tasks.read.all");
  if (
    !hasAllPermission &&
    task.assignedTo?.toString() !== req.user._id.toString() &&
    task.createdBy?.toString() !== req.user._id.toString()
  ) {
    throw new ApiError("You don't have access to this task", 403);
  }

  task.comments.push({
    text,
    author: req.user._id,
    createdAt: new Date(),
  });

  await task.save();
  await task.populate("comments.author", "name email avatar");

  new ApiResponse({ task }, "Comment added successfully").send(res);
});

/**
 * @desc    Add subtask
 * @route   POST /api/v1/tasks/:id/subtasks
 * @access  Private
 */
export const addSubtask = asyncHandler(async (req, res) => {
  const { title } = req.body;

  const task = await Task.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  });

  if (!task) {
    throw new ApiError("Task not found", 404);
  }

  // Check permissions
  const hasAllPermission = await req.user.hasPermission("tasks.update.all");
  if (
    !hasAllPermission &&
    task.assignedTo?.toString() !== req.user._id.toString()
  ) {
    throw new ApiError("You can only update your assigned tasks", 403);
  }

  task.subtasks.push({
    title,
    completed: false,
  });

  await task.save();

  new ApiResponse({ task }, "Subtask added successfully").send(res);
});

/**
 * @desc    Toggle subtask completion
 * @route   PUT /api/v1/tasks/:id/subtasks/:subtaskId
 * @access  Private
 */
export const toggleSubtask = asyncHandler(async (req, res) => {
  const { id, subtaskId } = req.params;

  const task = await Task.findOne({
    _id: id,
    venueId: req.user.venueId,
  });

  if (!task) {
    throw new ApiError("Task not found", 404);
  }

  // Check permissions
  const hasAllPermission = await req.user.hasPermission("tasks.update.all");
  if (
    !hasAllPermission &&
    task.assignedTo?.toString() !== req.user._id.toString()
  ) {
    throw new ApiError("You can only update your assigned tasks", 403);
  }

  const subtask = task.subtasks.id(subtaskId);

  if (!subtask) {
    throw new ApiError("Subtask not found", 404);
  }

  subtask.completed = !subtask.completed;
  if (subtask.completed) {
    subtask.completedAt = new Date();
    subtask.completedBy = req.user._id;
  } else {
    subtask.completedAt = undefined;
    subtask.completedBy = undefined;
  }

  await task.save();
  await task.populate("subtasks.completedBy", "name email");

  new ApiResponse({ task }, "Subtask updated successfully").send(res);
});

/**
 * @desc    Delete subtask
 * @route   DELETE /api/v1/tasks/:id/subtasks/:subtaskId
 * @access  Private
 */
export const deleteSubtask = asyncHandler(async (req, res) => {
  const { id, subtaskId } = req.params;

  const task = await Task.findOne({
    _id: id,
    venueId: req.user.venueId,
  });

  if (!task) {
    throw new ApiError("Task not found", 404);
  }

  // Check permissions
  const hasAllPermission = await req.user.hasPermission("tasks.update.all");
  if (
    !hasAllPermission &&
    task.assignedTo?.toString() !== req.user._id.toString()
  ) {
    throw new ApiError("You can only update your assigned tasks", 403);
  }

  // Use pull to remove the subtask
  task.subtasks.pull(subtaskId);

  await task.save();

  new ApiResponse({ task }, "Subtask deleted successfully").send(res);
});

/**
 * @desc    Add attachment to task
 * @route   POST /api/v1/tasks/:id/attachments
 * @access  Private
 */
export const addAttachment = asyncHandler(async (req, res) => {
  const { fileName, fileUrl } = req.body;

  const task = await Task.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  });

  if (!task) {
    throw new ApiError("Task not found", 404);
  }

  // Check permissions
  const hasAllPermission = await req.user.hasPermission("tasks.update.all");
  if (
    !hasAllPermission &&
    task.assignedTo?.toString() !== req.user._id.toString()
  ) {
    throw new ApiError("You can only update your assigned tasks", 403);
  }

  task.attachments.push({
    fileName,
    fileUrl,
    uploadDate: new Date(),
    uploadedBy: req.user._id,
  });

  await task.save();
  await task.populate("attachments.uploadedBy", "name email");

  new ApiResponse({ task }, "Attachment added successfully").send(res);
});

/**
 * @desc    Delete attachment
 * @route   DELETE /api/v1/tasks/:id/attachments/:attachmentId
 * @access  Private
 */
export const deleteAttachment = asyncHandler(async (req, res) => {
  const { id, attachmentId } = req.params;

  const task = await Task.findOne({
    _id: id,
    venueId: req.user.venueId,
  });

  if (!task) {
    throw new ApiError("Task not found", 404);
  }

  // Check permissions
  const hasAllPermission = await req.user.hasPermission("tasks.update.all");
  if (
    !hasAllPermission &&
    task.assignedTo?.toString() !== req.user._id.toString()
  ) {
    throw new ApiError("You can only update your assigned tasks", 403);
  }

  task.attachments.pull(attachmentId);

  await task.save();

  new ApiResponse({ task }, "Attachment deleted successfully").send(res);
});

/**
 * @desc    Get task statistics
 * @route   GET /api/v1/tasks/stats
 * @access  Private
 */
export const getTaskStats = asyncHandler(async (req, res) => {
  const venueId = req.user.venueId;

  const query = { venueId };

  // If user only has read.own, filter by assignedTo
  const hasAllPermission = await req.user.hasPermission("tasks.read.all");
  if (!hasAllPermission) {
    query.assignedTo = req.user._id;
  }

  const [
    statusStats,
    priorityStats,
    categoryStats,
    overdueTasks,
    todayTasks,
    thisWeekTasks,
  ] = await Promise.all([
    Task.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]),
    Task.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$priority",
          count: { $sum: 1 },
        },
      },
    ]),
    Task.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
        },
      },
    ]),
    Task.countDocuments({
      ...query,
      status: { $nin: ["completed", "cancelled"] },
      dueDate: { $lt: new Date() },
    }),
    Task.countDocuments({
      ...query,
      status: { $nin: ["completed", "cancelled"] },
      dueDate: {
        $gte: new Date(new Date().setHours(0, 0, 0, 0)),
        $lt: new Date(new Date().setHours(23, 59, 59, 999)),
      },
    }),
    Task.countDocuments({
      ...query,
      status: { $nin: ["completed", "cancelled"] },
      dueDate: {
        $gte: new Date(),
        $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    }),
  ]);

  // Calculate completion rate
  const totalTasks = statusStats.reduce((sum, stat) => sum + stat.count, 0);
  const completedTasksStat = statusStats.find((s) => s._id === "completed");
  const completedTasks = completedTasksStat ? completedTasksStat.count : 0;
  const completionRate =
    totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(2) : 0;

  new ApiResponse({
    statusStats,
    priorityStats,
    categoryStats,
    overdueTasks,
    todayTasks,
    thisWeekTasks,
    summary: {
      totalTasks,
      completedTasks,
      completionRate: parseFloat(completionRate),
    },
  }).send(res);
});

/**
 * @desc    Get tasks by board view (Kanban)
 * @route   GET /api/v1/tasks/board
 * @access  Private
 */
export const getTaskBoard = asyncHandler(async (req, res) => {
  const query = { venueId: req.user.venueId };

  // If user only has read.own, filter by assignedTo
  const hasAllPermission = await req.user.hasPermission("tasks.read.all");
  if (!hasAllPermission) {
    query.assignedTo = req.user._id;
  }

  const tasks = await Task.find(query)
    .populate("assignedTo", "name email avatar")
    .populate("relatedEvent", "title startDate")
    .sort({ priority: -1, dueDate: 1 });

  // Group tasks by status for Kanban board
  const board = {
    pending: [],
    todo: [],
    in_progress: [],
    completed: [],
    cancelled: [],
  };

  tasks.forEach((task) => {
    if (board[task.status]) {
      board[task.status].push(task);
    }
  });

  new ApiResponse({ board }).send(res);
});

/**
 * @desc    Get my tasks (for current user)
 * @route   GET /api/v1/tasks/my
 * @access  Private
 */
export const getMyTasks = asyncHandler(async (req, res) => {
  const { status, priority } = req.query;

  const query = {
    venueId: req.user.venueId,
    assignedTo: req.user._id,
  };

  if (status) query.status = status;
  if (priority) query.priority = priority;

  const tasks = await Task.find(query)
    .populate("relatedEvent", "title startDate")
    .populate("relatedClient", "name email")
    .sort({ dueDate: 1, priority: -1 })
    .limit(50);

  // Separate tasks into categories
  const categorized = {
    overdue: [],
    today: [],
    upcoming: [],
    completed: [],
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  tasks.forEach((task) => {
    if (task.status === "completed") {
      categorized.completed.push(task);
    } else if (task.dueDate < today) {
      categorized.overdue.push(task);
    } else if (task.dueDate >= today && task.dueDate < tomorrow) {
      categorized.today.push(task);
    } else {
      categorized.upcoming.push(task);
    }
  });

  new ApiResponse({
    tasks: categorized,
    total: tasks.length,
  }).send(res);
});