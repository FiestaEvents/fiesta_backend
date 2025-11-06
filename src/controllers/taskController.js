import asyncHandler from "../middleware/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { Task, Event, Client, Partner, User, Reminder } from "../models/index.js";
import mongoose from "mongoose";

// ============================================
// BASIC CRUD OPERATIONS
// ============================================

/**
 * @desc    Get all tasks with advanced filtering
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
    tags,
    relatedEvent,
    relatedClient,
    relatedPartner,
    isArchived = false,
    sortBy = "dueDate",
    sortOrder = "asc",
  } = req.query;

  // Build query
  const query = { 
    venueId: req.user.venueId,
    isArchived: isArchived === "true",
  };

  // Filters
  if (status) {
    query.status = Array.isArray(status) ? { $in: status } : status;
  }
  if (priority) {
    query.priority = Array.isArray(priority) ? { $in: priority } : priority;
  }
  if (category) query.category = category;
  if (assignedTo) query.assignedTo = assignedTo;
  if (relatedEvent) query.relatedEvent = relatedEvent;
  if (relatedClient) query.relatedClient = relatedClient;
  if (relatedPartner) query.relatedPartner = relatedPartner;

  // Tags filter
  if (tags) {
    const tagArray = Array.isArray(tags) ? tags : [tags];
    query.tags = { $in: tagArray };
  }

  // Due date range filter
  if (dueDateStart || dueDateEnd) {
    query.dueDate = {};
    if (dueDateStart) query.dueDate.$gte = new Date(dueDateStart);
    if (dueDateEnd) query.dueDate.$lte = new Date(dueDateEnd);
  }

  // Full-text search
  if (search) {
    query.$text = { $search: search };
  }

  // Check permissions
  const hasAllPermission = await req.user.hasPermission("tasks.read.all");
  if (!hasAllPermission) {
    query.$or = [
      { assignedTo: req.user._id },
      { createdBy: req.user._id },
      { watchers: req.user._id },
    ];
  }

  // Pagination
  const skip = (page - 1) * limit;

  // Sort configuration
  const sortConfig = {};
  sortConfig[sortBy] = sortOrder === "desc" ? -1 : 1;

  // Execute query
  const [tasks, total] = await Promise.all([
    Task.find(query)
      .populate("assignedTo", "name email avatar")
      .populate("assignedBy", "name email")
      .populate("watchers", "name email avatar")
      .populate("relatedEvent", "title startDate status")
      .populate("relatedClient", "name email")
      .populate("relatedPartner", "name category")
      .populate("createdBy", "name email")
      .populate("dependencies.task", "title status dueDate")
      .sort(sortConfig)
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
 * @desc    Get single task by ID
 * @route   GET /api/v1/tasks/:id
 * @access  Private
 */
export const getTask = asyncHandler(async (req, res) => {
  const { trackView = "true" } = req.query;

  const task = await Task.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  })
    .populate("assignedTo", "name email avatar phone")
    .populate("assignedBy", "name email")
    .populate("watchers", "name email avatar")
    .populate("relatedEvent")
    .populate("relatedClient")
    .populate("relatedPartner")
    .populate("createdBy", "name email")
    .populate("completedBy", "name email")
    .populate("cancelledBy", "name email")
    .populate("archivedBy", "name email")
    .populate("comments.author", "name email avatar")
    .populate("comments.mentions", "name email")
    .populate("subtasks.completedBy", "name email")
    .populate("attachments.uploadedBy", "name email")
    .populate("dependencies.task", "title status dueDate priority");

  if (!task) {
    throw new ApiError("Task not found", 404);
  }

  // Check access permissions
  const hasAllPermission = await req.user.hasPermission("tasks.read.all");
  const isAssignee = task.assignedTo?._id.toString() === req.user._id.toString();
  const isCreator = task.createdBy?._id.toString() === req.user._id.toString();
  const isWatcher = task.watchers.some(w => w._id.toString() === req.user._id.toString());

  if (!hasAllPermission && !isAssignee && !isCreator && !isWatcher) {
    throw new ApiError("You don't have access to this task", 403);
  }

  // Track view if enabled
  if (trackView === "true") {
    await task.trackView(req.user._id);
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

    taskData.assignedBy = req.user._id;
    taskData.assignedAt = new Date();
  }

  // Verify watchers
  if (taskData.watchers && taskData.watchers.length > 0) {
    const watchers = await User.find({
      _id: { $in: taskData.watchers },
      venueId: req.user.venueId,
      isActive: true,
    });

    if (watchers.length !== taskData.watchers.length) {
      throw new ApiError("One or more watchers not found or inactive", 404);
    }
  }

  // Verify related resources
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

  // Validate dependencies
  if (taskData.dependencies && taskData.dependencies.length > 0) {
    const dependencyIds = taskData.dependencies.map(d => d.task);
    const dependencyTasks = await Task.find({
      _id: { $in: dependencyIds },
      venueId: req.user.venueId,
    });

    if (dependencyTasks.length !== dependencyIds.length) {
      throw new ApiError("One or more dependency tasks not found", 404);
    }
  }

  const task = await Task.create(taskData);

  await task.populate([
    { path: "assignedTo", select: "name email avatar" },
    { path: "assignedBy", select: "name email" },
    { path: "watchers", select: "name email avatar" },
    { path: "relatedEvent", select: "title startDate" },
    { path: "relatedClient", select: "name email" },
    { path: "relatedPartner", select: "name category" },
    { path: "dependencies.task", select: "title status" },
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

  // Check permissions
  const hasAllPermission = await req.user.hasPermission("tasks.update.all");
  if (!hasAllPermission && !task.canModify(req.user._id)) {
    throw new ApiError("You don't have permission to update this task", 403);
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

    req.body.assignedBy = req.user._id;
    req.body.assignedAt = new Date();
  }

  // Handle status changes
  if (req.body.status && req.body.status !== task.status) {
    if (req.body.status === "completed") {
      req.body.completedAt = new Date();
      req.body.completedBy = req.user._id;
      req.body.progress = 100;
    } else if (req.body.status === "cancelled") {
      req.body.cancelledAt = new Date();
      req.body.cancelledBy = req.user._id;
      if (!req.body.cancellationReason) {
        throw new ApiError("Cancellation reason is required", 400);
      }
    } else if (req.body.status === "blocked") {
      if (!req.body.blockedReason) {
        throw new ApiError("Blocked reason is required", 400);
      }
    }

    // Clear completion data if status changed from completed
    if (task.status === "completed" && req.body.status !== "completed") {
      req.body.completedAt = undefined;
      req.body.completedBy = undefined;
    }
  }

  Object.assign(task, req.body);
  await task.save();

  await task.populate([
    { path: "assignedTo", select: "name email avatar" },
    { path: "assignedBy", select: "name email" },
    { path: "watchers", select: "name email avatar" },
    { path: "relatedEvent", select: "title startDate" },
    { path: "relatedClient", select: "name email" },
    { path: "relatedPartner", select: "name category" },
    { path: "completedBy", select: "name email" },
    { path: "cancelledBy", select: "name email" },
  ]);

  new ApiResponse({ task }, "Task updated successfully").send(res);
});

/**
 * @desc    Partially update task (PATCH)
 * @route   PATCH /api/v1/tasks/:id
 * @access  Private
 */
export const patchTask = asyncHandler(async (req, res) => {
  // Use the same logic as updateTask for PATCH
  req.method = "PUT";
  return updateTask(req, res);
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
 * @desc    Bulk delete tasks
 * @route   POST /api/v1/tasks/bulk-delete
 * @access  Private (tasks.delete.all)
 */
export const bulkDeleteTasks = asyncHandler(async (req, res) => {
  const { ids } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    throw new ApiError("Task IDs array is required", 400);
  }

  const result = await Task.deleteMany({
    _id: { $in: ids },
    venueId: req.user.venueId,
  });

  new ApiResponse(
    { deleted: result.deletedCount },
    `${result.deletedCount} task(s) deleted successfully`
  ).send(res);
});

// ============================================
// STATUS MANAGEMENT
// ============================================

/**
 * @desc    Update task status
 * @route   PATCH /api/v1/tasks/:id/status
 * @access  Private
 */
export const updateStatus = asyncHandler(async (req, res) => {
  const { status, blockedReason, cancellationReason } = req.body;

  const task = await Task.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  });

  if (!task) {
    throw new ApiError("Task not found", 404);
  }

  // Validate status-specific requirements
  if (status === "blocked" && !blockedReason) {
    throw new ApiError("Blocked reason is required", 400);
  }

  if (status === "cancelled" && !cancellationReason) {
    throw new ApiError("Cancellation reason is required", 400);
  }

  task.status = status;

  if (status === "completed") {
    task.completedAt = new Date();
    task.completedBy = req.user._id;
    task.progress = 100;
  } else if (status === "cancelled") {
    task.cancelledAt = new Date();
    task.cancelledBy = req.user._id;
    task.cancellationReason = cancellationReason;
  } else if (status === "blocked") {
    task.blockedReason = blockedReason;
  }

  await task.save();
  await task.populate([
    { path: "completedBy", select: "name email" },
    { path: "cancelledBy", select: "name email" },
  ]);

  new ApiResponse({ task }, "Task status updated successfully").send(res);
});

/**
 * @desc    Complete a task
 * @route   POST /api/v1/tasks/:id/complete
 * @access  Private
 */
export const completeTask = asyncHandler(async (req, res) => {
  const task = await Task.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  });

  if (!task) {
    throw new ApiError("Task not found", 404);
  }

  task.status = "completed";
  task.completedAt = new Date();
  task.completedBy = req.user._id;
  task.progress = 100;

  await task.save();
  await task.populate("completedBy", "name email");

  new ApiResponse({ task }, "Task completed successfully").send(res);
});

/**
 * @desc    Cancel a task
 * @route   POST /api/v1/tasks/:id/cancel
 * @access  Private
 */
export const cancelTask = asyncHandler(async (req, res) => {
  const { reason } = req.body;

  if (!reason) {
    throw new ApiError("Cancellation reason is required", 400);
  }

  const task = await Task.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  });

  if (!task) {
    throw new ApiError("Task not found", 404);
  }

  task.status = "cancelled";
  task.cancelledAt = new Date();
  task.cancelledBy = req.user._id;
  task.cancellationReason = reason;

  await task.save();
  await task.populate("cancelledBy", "name email");

  new ApiResponse({ task }, "Task cancelled successfully").send(res);
});

/**
 * @desc    Block a task
 * @route   POST /api/v1/tasks/:id/block
 * @access  Private
 */
export const blockTask = asyncHandler(async (req, res) => {
  const { reason } = req.body;

  if (!reason) {
    throw new ApiError("Blocked reason is required", 400);
  }

  const task = await Task.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  });

  if (!task) {
    throw new ApiError("Task not found", 404);
  }

  task.status = "blocked";
  task.blockedReason = reason;

  await task.save();

  new ApiResponse({ task }, "Task blocked successfully").send(res);
});

/**
 * @desc    Unblock a task
 * @route   POST /api/v1/tasks/:id/unblock
 * @access  Private
 */
export const unblockTask = asyncHandler(async (req, res) => {
  const task = await Task.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  });

  if (!task) {
    throw new ApiError("Task not found", 404);
  }

  if (task.status !== "blocked") {
    throw new ApiError("Task is not blocked", 400);
  }

  task.status = "in_progress";
  task.blockedReason = undefined;

  await task.save();

  new ApiResponse({ task }, "Task unblocked successfully").send(res);
});

// ============================================
// ASSIGNMENT & COLLABORATION
// ============================================

/**
 * @desc    Assign task to user
 * @route   PATCH /api/v1/tasks/:id/assign
 * @access  Private
 */
export const assignTask = asyncHandler(async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    throw new ApiError("User ID is required", 400);
  }

  const task = await Task.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  });

  if (!task) {
    throw new ApiError("Task not found", 404);
  }

  // Verify user exists and is active
  const assignee = await User.findOne({
    _id: userId,
    venueId: req.user.venueId,
    isActive: true,
  });

  if (!assignee) {
    throw new ApiError("User not found or inactive", 404);
  }

  task.assignedTo = userId;
  task.assignedBy = req.user._id;
  task.assignedAt = new Date();

  await task.save();
  await task.populate([
    { path: "assignedTo", select: "name email avatar" },
    { path: "assignedBy", select: "name email" },
  ]);

  new ApiResponse({ task }, "Task assigned successfully").send(res);
});

/**
 * @desc    Unassign task
 * @route   PATCH /api/v1/tasks/:id/unassign
 * @access  Private
 */
export const unassignTask = asyncHandler(async (req, res) => {
  const task = await Task.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  });

  if (!task) {
    throw new ApiError("Task not found", 404);
  }

  task.assignedTo = undefined;
  task.assignedBy = undefined;
  task.assignedAt = undefined;

  await task.save();

  new ApiResponse({ task }, "Task unassigned successfully").send(res);
});

/**
 * @desc    Add watcher to task
 * @route   POST /api/v1/tasks/:id/watchers
 * @access  Private
 */
export const addWatcher = asyncHandler(async (req, res) => {
  const { userId } = req.body;

  const task = await Task.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  });

  if (!task) {
    throw new ApiError("Task not found", 404);
  }

  // Verify user exists
  const user = await User.findOne({
    _id: userId,
    venueId: req.user.venueId,
    isActive: true,
  });

  if (!user) {
    throw new ApiError("User not found or inactive", 404);
  }

  await task.addWatcher(userId);
  await task.populate("watchers", "name email avatar");

  new ApiResponse({ task }, "Watcher added successfully").send(res);
});

/**
 * @desc    Remove watcher from task
 * @route   DELETE /api/v1/tasks/:id/watchers/:userId
 * @access  Private
 */
export const removeWatcher = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const task = await Task.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  });

  if (!task) {
    throw new ApiError("Task not found", 404);
  }

  await task.removeWatcher(userId);
  await task.populate("watchers", "name email avatar");

  new ApiResponse({ task }, "Watcher removed successfully").send(res);
});

// ============================================
// COMMENTS
// ============================================

/**
 * @desc    Add comment to task
 * @route   POST /api/v1/tasks/:id/comments
 * @access  Private
 */
export const addComment = asyncHandler(async (req, res) => {
  const { text, mentions = [] } = req.body;

  const task = await Task.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  });

  if (!task) {
    throw new ApiError("Task not found", 404);
  }

  // Check access
  const hasAllPermission = await req.user.hasPermission("tasks.read.all");
  const isAssignee = task.assignedTo?.toString() === req.user._id.toString();
  const isCreator = task.createdBy?.toString() === req.user._id.toString();
  const isWatcher = task.watchers.some(w => w.toString() === req.user._id.toString());

  if (!hasAllPermission && !isAssignee && !isCreator && !isWatcher) {
    throw new ApiError("You don't have access to this task", 403);
  }

  await task.addComment(text, req.user._id, mentions);
  await task.populate([
    { path: "comments.author", select: "name email avatar" },
    { path: "comments.mentions", select: "name email" },
  ]);

  const newComment = task.comments[task.comments.length - 1];

  new ApiResponse(
    { task, comment: newComment },
    "Comment added successfully"
  ).send(res);
});

/**
 * @desc    Edit comment
 * @route   PUT /api/v1/tasks/:id/comments/:commentId
 * @access  Private
 */
export const editComment = asyncHandler(async (req, res) => {
  const { text } = req.body;
  const { id, commentId } = req.params;

  const task = await Task.findOne({
    _id: id,
    venueId: req.user.venueId,
  });

  if (!task) {
    throw new ApiError("Task not found", 404);
  }

  const comment = task.comments.id(commentId);

  if (!comment) {
    throw new ApiError("Comment not found", 404);
  }

  // Only comment author can edit
  if (comment.author.toString() !== req.user._id.toString()) {
    throw new ApiError("You can only edit your own comments", 403);
  }

  comment.text = text;
  comment.isEdited = true;
  comment.editedAt = new Date();

  await task.save();
  await task.populate("comments.author", "name email avatar");

  new ApiResponse({ task }, "Comment updated successfully").send(res);
});

/**
 * @desc    Delete comment
 * @route   DELETE /api/v1/tasks/:id/comments/:commentId
 * @access  Private
 */
export const deleteComment = asyncHandler(async (req, res) => {
  const { id, commentId } = req.params;

  const task = await Task.findOne({
    _id: id,
    venueId: req.user.venueId,
  });

  if (!task) {
    throw new ApiError("Task not found", 404);
  }

  const comment = task.comments.id(commentId);

  if (!comment) {
    throw new ApiError("Comment not found", 404);
  }

  // Only comment author or task creator can delete
  const isAuthor = comment.author.toString() === req.user._id.toString();
  const isTaskCreator = task.createdBy?.toString() === req.user._id.toString();
  const hasAllPermission = await req.user.hasPermission("tasks.delete.all");

  if (!isAuthor && !isTaskCreator && !hasAllPermission) {
    throw new ApiError("You don't have permission to delete this comment", 403);
  }

  task.comments.pull(commentId);
  await task.save();

  new ApiResponse({ task }, "Comment deleted successfully").send(res);
});

// ============================================
// SUBTASKS
// ============================================

/**
 * @desc    Add subtask
 * @route   POST /api/v1/tasks/:id/subtasks
 * @access  Private
 */
export const addSubtask = asyncHandler(async (req, res) => {
  const { title, description } = req.body;

  const task = await Task.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  });

  if (!task) {
    throw new ApiError("Task not found", 404);
  }

  // Check permissions
  const hasAllPermission = await req.user.hasPermission("tasks.update.all");
  if (!hasAllPermission && !task.canModify(req.user._id)) {
    throw new ApiError("You don't have permission to update this task", 403);
  }

  await task.addSubtask(title, description);

  const newSubtask = task.subtasks[task.subtasks.length - 1];

  new ApiResponse(
    { task, subtask: newSubtask },
    "Subtask added successfully"
  ).send(res);
});

/**
 * @desc    Update subtask
 * @route   PUT /api/v1/tasks/:id/subtasks/:subtaskId
 * @access  Private
 */
export const updateSubtask = asyncHandler(async (req, res) => {
  const { id, subtaskId } = req.params;
  const { title, description } = req.body;

  const task = await Task.findOne({
    _id: id,
    venueId: req.user.venueId,
  });

  if (!task) {
    throw new ApiError("Task not found", 404);
  }

  const subtask = task.subtasks.id(subtaskId);

  if (!subtask) {
    throw new ApiError("Subtask not found", 404);
  }

  if (title) subtask.title = title;
  if (description !== undefined) subtask.description = description;

  await task.save();

  new ApiResponse({ task }, "Subtask updated successfully").send(res);
});

/**
 * @desc    Toggle subtask completion
 * @route   PATCH /api/v1/tasks/:id/subtasks/:subtaskId/toggle
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

  await task.toggleSubtask(subtaskId, req.user._id);
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

  task.subtasks.pull(subtaskId);
  await task.save();

  new ApiResponse({ task }, "Subtask deleted successfully").send(res);
});

/**
 * @desc    Reorder subtasks
 * @route   PATCH /api/v1/tasks/:id/subtasks/reorder
 * @access  Private
 */
export const reorderSubtasks = asyncHandler(async (req, res) => {
  const { subtasks } = req.body; // [{ id, order }]

  if (!subtasks || !Array.isArray(subtasks)) {
    throw new ApiError("Subtasks array is required", 400);
  }

  const task = await Task.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  });

  if (!task) {
    throw new ApiError("Task not found", 404);
  }

  // Update order for each subtask
  subtasks.forEach(({ id, order }) => {
    const subtask = task.subtasks.id(id);
    if (subtask) {
      subtask.order = order;
    }
  });

  await task.save();

  new ApiResponse({ task }, "Subtasks reordered successfully").send(res);
});

// ============================================
// ATTACHMENTS
// ============================================

/**
 * @desc    Add attachment to task
 * @route   POST /api/v1/tasks/:id/attachments
 * @access  Private
 */
export const addAttachment = asyncHandler(async (req, res) => {
  const { fileName, fileUrl, fileSize, fileType } = req.body;

  const task = await Task.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  });

  if (!task) {
    throw new ApiError("Task not found", 404);
  }

  task.attachments.push({
    fileName,
    fileUrl,
    fileSize,
    fileType,
    uploadDate: new Date(),
    uploadedBy: req.user._id,
  });

  await task.save();
  await task.populate("attachments.uploadedBy", "name email");

  const newAttachment = task.attachments[task.attachments.length - 1];

  new ApiResponse(
    { task, attachment: newAttachment },
    "Attachment added successfully"
  ).send(res);
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

  task.attachments.pull(attachmentId);
  await task.save();

  new ApiResponse({ task }, "Attachment deleted successfully").send(res);
});

// ============================================
// TAGS
// ============================================

/**
 * @desc    Add tags to task
 * @route   POST /api/v1/tasks/:id/tags
 * @access  Private
 */
export const addTags = asyncHandler(async (req, res) => {
  const { tags } = req.body;

  if (!tags || !Array.isArray(tags)) {
    throw new ApiError("Tags array is required", 400);
  }

  const task = await Task.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  });

  if (!task) {
    throw new ApiError("Task not found", 404);
  }

  // Add only unique tags
  tags.forEach(tag => {
    if (!task.tags.includes(tag.toLowerCase())) {
      task.tags.push(tag.toLowerCase());
    }
  });

  await task.save();

  new ApiResponse({ task }, "Tags added successfully").send(res);
});

/**
 * @desc    Remove tags from task
 * @route   DELETE /api/v1/tasks/:id/tags
 * @access  Private
 */
export const removeTags = asyncHandler(async (req, res) => {
  const { tags } = req.body;

  if (!tags || !Array.isArray(tags)) {
    throw new ApiError("Tags array is required", 400);
  }

  const task = await Task.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  });

  if (!task) {
    throw new ApiError("Task not found", 404);
  }

  task.tags = task.tags.filter(tag => !tags.includes(tag));
  await task.save();

  new ApiResponse({ task }, "Tags removed successfully").send(res);
});

// ============================================
// DEPENDENCIES
// ============================================

/**
 * @desc    Add dependency to task
 * @route   POST /api/v1/tasks/:id/dependencies
 * @access  Private
 */
export const addDependency = asyncHandler(async (req, res) => {
  const { dependencyTaskId, type = "relates_to" } = req.body;

  if (!dependencyTaskId) {
    throw new ApiError("Dependency task ID is required", 400);
  }

  const task = await Task.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  });

  if (!task) {
    throw new ApiError("Task not found", 404);
  }

  // Verify dependency task exists
  const dependencyTask = await Task.findOne({
    _id: dependencyTaskId,
    venueId: req.user.venueId,
  });

  if (!dependencyTask) {
    throw new ApiError("Dependency task not found", 404);
  }

  // Check if dependency already exists
  const existingDep = task.dependencies.find(
    d => d.task.toString() === dependencyTaskId
  );

  if (existingDep) {
    throw new ApiError("Dependency already exists", 400);
  }

  task.dependencies.push({ task: dependencyTaskId, type });
  await task.save();
  await task.populate("dependencies.task", "title status dueDate priority");

  new ApiResponse({ task }, "Dependency added successfully").send(res);
});

/**
 * @desc    Remove dependency from task
 * @route   DELETE /api/v1/tasks/:id/dependencies/:dependencyId
 * @access  Private
 */
export const removeDependency = asyncHandler(async (req, res) => {
  const { id, dependencyId } = req.params;

  const task = await Task.findOne({
    _id: id,
    venueId: req.user.venueId,
  });

  if (!task) {
    throw new ApiError("Task not found", 404);
  }

  task.dependencies.pull(dependencyId);
  await task.save();

  new ApiResponse({ task }, "Dependency removed successfully").send(res);
});

// ============================================
// PROGRESS TRACKING
// ============================================

/**
 * @desc    Update task progress
 * @route   PATCH /api/v1/tasks/:id/progress
 * @access  Private
 */
export const updateProgress = asyncHandler(async (req, res) => {
  const { progress } = req.body;

  if (progress === undefined || progress < 0 || progress > 100) {
    throw new ApiError("Progress must be between 0 and 100", 400);
  }

  const task = await Task.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  });

  if (!task) {
    throw new ApiError("Task not found", 404);
  }

  task.progress = progress;

  // Auto-complete if progress is 100%
  if (progress === 100 && task.status !== "completed") {
    task.status = "completed";
    task.completedAt = new Date();
    task.completedBy = req.user._id;
  }

  await task.save();

  new ApiResponse({ task }, "Progress updated successfully").send(res);
});

/**
 * @desc    Log time spent on task
 * @route   POST /api/v1/tasks/:id/time-log
 * @access  Private
 */
export const logTime = asyncHandler(async (req, res) => {
  const { hours, description } = req.body;

  if (!hours || hours <= 0) {
    throw new ApiError("Valid hours value is required", 400);
  }

  const task = await Task.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  });

  if (!task) {
    throw new ApiError("Task not found", 404);
  }

  task.actualHours = (task.actualHours || 0) + hours;
  await task.save();

  new ApiResponse(
    { task, timeLogged: hours, totalTime: task.actualHours },
    "Time logged successfully"
  ).send(res);
});

// ============================================
// ARCHIVE & RESTORE
// ============================================

/**
 * @desc    Archive task
 * @route   POST /api/v1/tasks/:id/archive
 * @access  Private
 */
export const archiveTask = asyncHandler(async (req, res) => {
  const task = await Task.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  });

  if (!task) {
    throw new ApiError("Task not found", 404);
  }

  await task.archive(req.user._id);
  await task.populate("archivedBy", "name email");

  new ApiResponse({ task }, "Task archived successfully").send(res);
});

/**
 * @desc    Unarchive/restore task
 * @route   POST /api/v1/tasks/:id/unarchive
 * @access  Private
 */
export const unarchiveTask = asyncHandler(async (req, res) => {
  const task = await Task.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
    isArchived: true,
  });

  if (!task) {
    throw new ApiError("Archived task not found", 404);
  }

  await task.unarchive();

  new ApiResponse({ task }, "Task restored successfully").send(res);
});

/**
 * @desc    Get archived tasks
 * @route   GET /api/v1/tasks/archived
 * @access  Private
 */
export const getArchivedTasks = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;

  const query = {
    venueId: req.user.venueId,
    isArchived: true,
  };

  const skip = (page - 1) * limit;

  const [tasks, total] = await Promise.all([
    Task.find(query)
      .populate("assignedTo", "name email avatar")
      .populate("archivedBy", "name email")
      .sort({ archivedAt: -1 })
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

// ============================================
// VIEWS & FILTERS
// ============================================

/**
 * @desc    Get task board view (Kanban)
 * @route   GET /api/v1/tasks/board
 * @access  Private
 */
export const getTaskBoard = asyncHandler(async (req, res) => {
  const { relatedEvent, assignedTo } = req.query;

  const query = { 
    venueId: req.user.venueId,
    isArchived: false,
  };

  if (relatedEvent) query.relatedEvent = relatedEvent;
  if (assignedTo) query.assignedTo = assignedTo;

  // Check permissions
  const hasAllPermission = await req.user.hasPermission("tasks.read.all");
  if (!hasAllPermission) {
    query.$or = [
      { assignedTo: req.user._id },
      { createdBy: req.user._id },
      { watchers: req.user._id },
    ];
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
    blocked: [],
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
  const { status, priority, includeCompleted = "false" } = req.query;

  const query = {
    venueId: req.user.venueId,
    isArchived: false,
    $or: [
      { assignedTo: req.user._id },
      { createdBy: req.user._id },
      { watchers: req.user._id },
    ],
  };

  if (status) query.status = status;
  if (priority) query.priority = priority;

  if (includeCompleted === "false") {
    query.status = { $nin: ["completed", "cancelled"] };
  }

  const tasks = await Task.find(query)
    .populate("relatedEvent", "title startDate")
    .populate("relatedClient", "name email")
    .populate("assignedBy", "name email")
    .sort({ dueDate: 1, priority: -1 })
    .limit(100);

  // Categorize tasks
  const categorized = {
    overdue: [],
    today: [],
    upcoming: [],
    completed: [],
    blocked: [],
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  tasks.forEach((task) => {
    if (task.status === "blocked") {
      categorized.blocked.push(task);
    } else if (task.status === "completed") {
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

/**
 * @desc    Get overdue tasks
 * @route   GET /api/v1/tasks/overdue
 * @access  Private
 */
export const getOverdueTasks = asyncHandler(async (req, res) => {
  const tasks = await Task.getOverdue(req.user.venueId);

  await Task.populate(tasks, [
    { path: "assignedTo", select: "name email avatar" },
    { path: "relatedEvent", select: "title startDate" },
  ]);

  new ApiResponse({ tasks, count: tasks.length }).send(res);
});

/**
 * @desc    Get tasks due today
 * @route   GET /api/v1/tasks/due-today
 * @access  Private
 */
export const getDueTodayTasks = asyncHandler(async (req, res) => {
  const tasks = await Task.getDueToday(req.user.venueId);

  await Task.populate(tasks, [
    { path: "assignedTo", select: "name email avatar" },
    { path: "relatedEvent", select: "title startDate" },
  ]);

  new ApiResponse({ tasks, count: tasks.length }).send(res);
});

/**
 * @desc    Get upcoming tasks (within specified days)
 * @route   GET /api/v1/tasks/upcoming
 * @access  Private
 */
export const getUpcomingTasks = asyncHandler(async (req, res) => {
  const { days = 7 } = req.query;

  const endDate = new Date();
  endDate.setDate(endDate.getDate() + parseInt(days));

  const tasks = await Task.find({
    venueId: req.user.venueId,
    isArchived: false,
    status: { $nin: ["completed", "cancelled"] },
    dueDate: {
      $gte: new Date(),
      $lte: endDate,
    },
  })
    .populate("assignedTo", "name email avatar")
    .populate("relatedEvent", "title startDate")
    .sort({ dueDate: 1 });

  new ApiResponse({ tasks, count: tasks.length, days: parseInt(days) }).send(res);
});

/**
 * @desc    Get tasks by event
 * @route   GET /api/v1/tasks/event/:eventId
 * @access  Private
 */
export const getTasksByEvent = asyncHandler(async (req, res) => {
  const { eventId } = req.params;

  const tasks = await Task.find({
    venueId: req.user.venueId,
    relatedEvent: eventId,
    isArchived: false,
  })
    .populate("assignedTo", "name email avatar")
    .sort({ dueDate: 1, priority: -1 });

  new ApiResponse({ tasks, count: tasks.length }).send(res);
});

/**
 * @desc    Get tasks by client
 * @route   GET /api/v1/tasks/client/:clientId
 * @access  Private
 */
export const getTasksByClient = asyncHandler(async (req, res) => {
  const { clientId } = req.params;

  const tasks = await Task.find({
    venueId: req.user.venueId,
    relatedClient: clientId,
    isArchived: false,
  })
    .populate("assignedTo", "name email avatar")
    .sort({ dueDate: 1, priority: -1 });

  new ApiResponse({ tasks, count: tasks.length }).send(res);
});

/**
 * @desc    Get tasks by partner
 * @route   GET /api/v1/tasks/partner/:partnerId
 * @access  Private
 */
export const getTasksByPartner = asyncHandler(async (req, res) => {
  const { partnerId } = req.params;

  const tasks = await Task.find({
    venueId: req.user.venueId,
    relatedPartner: partnerId,
    isArchived: false,
  })
    .populate("assignedTo", "name email avatar")
    .sort({ dueDate: 1, priority: -1 });

  new ApiResponse({ tasks, count: tasks.length }).send(res);
});

/**
 * @desc    Search tasks
 * @route   GET /api/v1/tasks/search
 * @access  Private
 */
export const searchTasks = asyncHandler(async (req, res) => {
  const { q, ...filters } = req.query;

  if (!q) {
    throw new ApiError("Search query is required", 400);
  }

  const query = {
    venueId: req.user.venueId,
    isArchived: false,
    $text: { $search: q },
  };

  // Apply additional filters
  if (filters.status) query.status = filters.status;
  if (filters.priority) query.priority = filters.priority;
  if (filters.assignedTo) query.assignedTo = filters.assignedTo;

  const tasks = await Task.find(query, { score: { $meta: "textScore" } })
    .populate("assignedTo", "name email avatar")
    .populate("relatedEvent", "title")
    .sort({ score: { $meta: "textScore" } })
    .limit(50);

  new ApiResponse({ tasks, count: tasks.length, query: q }).send(res);
});

// ============================================
// STATISTICS & ANALYTICS
// ============================================

/**
 * @desc    Get task statistics
 * @route   GET /api/v1/tasks/stats
 * @access  Private
 */
export const getTaskStats = asyncHandler(async (req, res) => {
  const stats = await Task.getStatistics(req.user.venueId);

  new ApiResponse({ stats }).send(res);
});

/**
 * @desc    Get task completion rate over time
 * @route   GET /api/v1/tasks/analytics/completion-rate
 * @access  Private
 */
export const getCompletionRate = asyncHandler(async (req, res) => {
  const { startDate, endDate, groupBy = "week" } = req.query;

  const matchQuery = { venueId: new mongoose.Types.ObjectId(req.user.venueId) };

  if (startDate || endDate) {
    matchQuery.completedAt = {};
    if (startDate) matchQuery.completedAt.$gte = new Date(startDate);
    if (endDate) matchQuery.completedAt.$lte = new Date(endDate);
  }

  let dateGrouping;
  if (groupBy === "day") {
    dateGrouping = { $dateToString: { format: "%Y-%m-%d", date: "$completedAt" } };
  } else if (groupBy === "month") {
    dateGrouping = { $dateToString: { format: "%Y-%m", date: "$completedAt" } };
  } else {
    // week
    dateGrouping = {
      $dateToString: { format: "%Y-%U", date: "$completedAt" },
    };
  }

  const data = await Task.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: dateGrouping,
        completed: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  new ApiResponse({ data, groupBy }).send(res);
});

/**
 * @desc    Get task distribution
 * @route   GET /api/v1/tasks/analytics/distribution
 * @access  Private
 */
export const getDistribution = asyncHandler(async (req, res) => {
  const { groupBy = "status" } = req.query;

  const validGroupBy = ["status", "priority", "category", "assignedTo"];
  if (!validGroupBy.includes(groupBy)) {
    throw new ApiError(`groupBy must be one of: ${validGroupBy.join(", ")}`, 400);
  }

  const distribution = await Task.aggregate([
    {
      $match: {
        venueId: new mongoose.Types.ObjectId(req.user.venueId),
        isArchived: false,
      },
    },
    {
      $group: {
        _id: `$${groupBy}`,
        count: { $sum: 1 },
        completed: {
          $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
        },
      },
    },
    { $sort: { count: -1 } },
  ]);

  new ApiResponse({ distribution, groupBy }).send(res);
});

/**
 * @desc    Get user productivity metrics
 * @route   GET /api/v1/tasks/analytics/me
 * @access  Private
 */
export const getUserProductivity = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  const matchQuery = {
    venueId: new mongoose.Types.ObjectId(req.user.venueId),
    assignedTo: new mongoose.Types.ObjectId(req.user._id),
  };

  if (startDate || endDate) {
    matchQuery.createdAt = {};
    if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
    if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
  }

  const metrics = await Task.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalTasks: { $sum: 1 },
        completedTasks: {
          $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
        },
        overdueTasks: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $lt: ["$dueDate", new Date()] },
                  { $nin: ["$status", ["completed", "cancelled"]] },
                ],
              },
              1,
              0,
            ],
          },
        },
        totalEstimatedHours: { $sum: { $ifNull: ["$estimatedHours", 0] } },
        totalActualHours: { $sum: { $ifNull: ["$actualHours", 0] } },
        avgProgress: { $avg: "$progress" },
      },
    },
  ]);

  const result = metrics[0] || {
    totalTasks: 0,
    completedTasks: 0,
    overdueTasks: 0,
    totalEstimatedHours: 0,
    totalActualHours: 0,
    avgProgress: 0,
  };

  result.completionRate =
    result.totalTasks > 0
      ? ((result.completedTasks / result.totalTasks) * 100).toFixed(2)
      : 0;

  new ApiResponse({ metrics: result }).send(res);
});

// ============================================
// BULK OPERATIONS
// ============================================

/**
 * @desc    Bulk update tasks
 * @route   PATCH /api/v1/tasks/bulk-update
 * @access  Private (tasks.update.all)
 */
export const bulkUpdateTasks = asyncHandler(async (req, res) => {
  const { ids, data } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    throw new ApiError("Task IDs array is required", 400);
  }

  if (!data || Object.keys(data).length === 0) {
    throw new ApiError("Update data is required", 400);
  }

  const result = await Task.updateMany(
    {
      _id: { $in: ids },
      venueId: req.user.venueId,
    },
    { $set: data }
  );

  new ApiResponse(
    { updated: result.modifiedCount },
    `${result.modifiedCount} task(s) updated successfully`
  ).send(res);
});

/**
 * @desc    Bulk assign tasks
 * @route   PATCH /api/v1/tasks/bulk-assign
 * @access  Private (tasks.update.all)
 */
export const bulkAssignTasks = asyncHandler(async (req, res) => {
  const { ids, userId } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    throw new ApiError("Task IDs array is required", 400);
  }

  if (!userId) {
    throw new ApiError("User ID is required", 400);
  }

  // Verify user exists
  const user = await User.findOne({
    _id: userId,
    venueId: req.user.venueId,
    isActive: true,
  });

  if (!user) {
    throw new ApiError("User not found or inactive", 404);
  }

  const result = await Task.updateMany(
    {
      _id: { $in: ids },
      venueId: req.user.venueId,
    },
    {
      $set: {
        assignedTo: userId,
        assignedBy: req.user._id,
        assignedAt: new Date(),
      },
    }
  );

  new ApiResponse(
    { updated: result.modifiedCount },
    `${result.modifiedCount} task(s) assigned successfully`
  ).send(res);
});

/**
 * @desc    Bulk complete tasks
 * @route   POST /api/v1/tasks/bulk-complete
 * @access  Private (tasks.update.all)
 */
export const bulkCompleteTasks = asyncHandler(async (req, res) => {
  const { ids } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    throw new ApiError("Task IDs array is required", 400);
  }

  const result = await Task.updateMany(
    {
      _id: { $in: ids },
      venueId: req.user.venueId,
      status: { $nin: ["completed", "cancelled"] },
    },
    {
      $set: {
        status: "completed",
        completedAt: new Date(),
        completedBy: req.user._id,
        progress: 100,
      },
    }
  );

  new ApiResponse(
    { completed: result.modifiedCount },
    `${result.modifiedCount} task(s) completed successfully`
  ).send(res);
});

/**
 * @desc    Bulk archive tasks
 * @route   POST /api/v1/tasks/bulk-archive
 * @access  Private (tasks.update.all)
 */
export const bulkArchiveTasks = asyncHandler(async (req, res) => {
  const { ids } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    throw new ApiError("Task IDs array is required", 400);
  }

  const result = await Task.updateMany(
    {
      _id: { $in: ids },
      venueId: req.user.venueId,
      isArchived: false,
    },
    {
      $set: {
        isArchived: true,
        archivedAt: new Date(),
        archivedBy: req.user._id,
      },
    }
  );

  new ApiResponse(
    { archived: result.modifiedCount },
    `${result.modifiedCount} task(s) archived successfully`
  ).send(res);
});

// ============================================
// DUPLICATE
// ============================================

/**
 * @desc    Duplicate/clone a task
 * @route   POST /api/v1/tasks/:id/duplicate
 * @access  Private (tasks.create)
 */
export const duplicateTask = asyncHandler(async (req, res) => {
  const originalTask = await Task.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  });

  if (!originalTask) {
    throw new ApiError("Task not found", 404);
  }

  // Create copy excluding certain fields
  const taskCopy = originalTask.toObject();
  delete taskCopy._id;
  delete taskCopy.createdAt;
  delete taskCopy.updatedAt;
  delete taskCopy.completedAt;
  delete taskCopy.completedBy;
  delete taskCopy.cancelledAt;
  delete taskCopy.cancelledBy;
  delete taskCopy.archivedAt;
  delete taskCopy.archivedBy;
  delete taskCopy.isArchived;
  delete taskCopy.metadata;

  // Reset status and progress
  taskCopy.status = "pending";
  taskCopy.progress = 0;
  taskCopy.createdBy = req.user._id;
  taskCopy.title = `${taskCopy.title} (Copy)`;

  // Clear comments and attachments
  taskCopy.comments = [];
  taskCopy.attachments = [];

  // Reset subtasks completion
  if (taskCopy.subtasks) {
    taskCopy.subtasks = taskCopy.subtasks.map(st => ({
      title: st.title,
      description: st.description,
      order: st.order,
      completed: false,
    }));
  }

  // Apply any overrides from request body
  Object.assign(taskCopy, req.body);

  const newTask = await Task.create(taskCopy);

  await newTask.populate([
    { path: "assignedTo", select: "name email avatar" },
    { path: "relatedEvent", select: "title startDate" },
    { path: "relatedClient", select: "name email" },
    { path: "relatedPartner", select: "name category" },
  ]);

  new ApiResponse({ task: newTask }, "Task duplicated successfully", 201).send(res);
});

// ============================================
// EXPORT
// ============================================

/**
 * @desc    Export tasks to CSV/Excel
 * @route   GET /api/v1/tasks/export
 * @access  Private
 */
export const exportTasks = asyncHandler(async (req, res) => {
  const { format = "csv", ...filters } = req.query;

  const query = { venueId: req.user.venueId, isArchived: false };

  // Apply filters
  if (filters.status) query.status = filters.status;
  if (filters.priority) query.priority = filters.priority;
  if (filters.category) query.category = filters.category;
  if (filters.assignedTo) query.assignedTo = filters.assignedTo;

  const tasks = await Task.find(query)
    .populate("assignedTo", "name email")
    .populate("relatedEvent", "title")
    .populate("relatedClient", "name")
    .populate("createdBy", "name")
    .sort({ dueDate: 1 });

  if (format === "json") {
    return new ApiResponse({ tasks, count: tasks.length }).send(res);
  }

  // CSV export
  const csv = [
    // Header
    [
      "ID",
      "Title",
      "Description",
      "Status",
      "Priority",
      "Category",
      "Assigned To",
      "Related Event",
      "Related Client",
      "Due Date",
      "Progress",
      "Estimated Hours",
      "Actual Hours",
      "Created By",
      "Created At",
    ].join(","),
    // Data rows
    ...tasks.map((task) =>
      [
        task._id,
        `"${task.title.replace(/"/g, '""')}"`,
        `"${(task.description || "").replace(/"/g, '""')}"`,
        task.status,
        task.priority,
        task.category,
        task.assignedTo?.name || "",
        task.relatedEvent?.title || "",
        task.relatedClient?.name || "",
        task.dueDate.toISOString().split("T")[0],
        task.progress || 0,
        task.estimatedHours || 0,
        task.actualHours || 0,
        task.createdBy?.name || "",
        task.createdAt.toISOString().split("T")[0],
      ].join(",")
    ),
  ].join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="tasks_export_${Date.now()}.csv"`);
  res.send(csv);
});