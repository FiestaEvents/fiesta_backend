import mongoose from "mongoose"; // ✅ Added missing import for aggregation
import asyncHandler from "../middleware/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { Task, User } from "../models/index.js";

/**
 * Helper to safely get Business ID string
 */
const getBusinessId = (user) => {
  if (!user || !user.businessId) return null;
  return user.businessId._id ? user.businessId._id : user.businessId;
};

// ============================================
// BASIC CRUD
// ============================================

export const getTasks = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    status,
    priority,
    category,
    assignedTo,
    search,
    isArchived = "false",
    sortBy = "dueDate",
    sortOrder = "asc",
  } = req.query;

  const businessId = getBusinessId(req.user);

  const query = {
    businessId,
    isArchived: isArchived === "true",
  };

  if (status) query.status = status;
  if (priority) query.priority = priority;
  if (category) query.category = category;
  if (assignedTo) query.assignedTo = assignedTo;
  if (search) query.$text = { $search: search };

  const skip = (page - 1) * limit;
  const sortConfig = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

  const [tasks, total] = await Promise.all([
    Task.find(query)
      .populate("assignedTo", "name email avatar")
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

export const getTask = asyncHandler(async (req, res) => {
  const businessId = getBusinessId(req.user);

  const task = await Task.findOne({
    _id: req.params.id,
    businessId,
  }).populate("assignedTo", "name email avatar");

  if (!task) throw new ApiError("Task not found", 404);

  new ApiResponse({ task }).send(res);
});

export const createTask = asyncHandler(async (req, res) => {
  const businessId = getBusinessId(req.user);

  const task = await Task.create({
    ...req.body,
    businessId,
    createdBy: req.user._id,
  });

  await task.populate("assignedTo", "name email avatar");
  new ApiResponse({ task }, "Task created successfully", 201).send(res);
});

export const updateTask = asyncHandler(async (req, res) => {
  const businessId = getBusinessId(req.user);

  const task = await Task.findOneAndUpdate(
    { _id: req.params.id, businessId },
    req.body,
    { new: true, runValidators: true }
  ).populate("assignedTo", "name email avatar");

  if (!task) throw new ApiError("Task not found", 404);

  new ApiResponse({ task }, "Task updated successfully").send(res);
});

export const deleteTask = asyncHandler(async (req, res) => {
  const businessId = getBusinessId(req.user);

  const task = await Task.findOneAndDelete({
    _id: req.params.id,
    businessId,
  });

  if (!task) throw new ApiError("Task not found", 404);

  new ApiResponse(null, "Task deleted successfully").send(res);
});

export const bulkDeleteTasks = asyncHandler(async (req, res) => {
  const { ids } = req.body;
  const businessId = getBusinessId(req.user);

  await Task.deleteMany({
    _id: { $in: ids },
    businessId,
  });
  new ApiResponse(null, "Tasks deleted successfully").send(res);
});

// ============================================
// STATUS MANAGEMENT
// ============================================

export const updateStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const businessId = getBusinessId(req.user);

  const task = await Task.findOneAndUpdate(
    { _id: req.params.id, businessId },
    { status },
    { new: true }
  );
  if (!task) throw new ApiError("Task not found", 404);
  new ApiResponse({ task }, "Status updated").send(res);
});

export const completeTask = asyncHandler(async (req, res) => {
  const businessId = getBusinessId(req.user);

  const task = await Task.findOneAndUpdate(
    { _id: req.params.id, businessId },
    { status: "completed" },
    { new: true }
  );
  if (!task) throw new ApiError("Task not found", 404);
  new ApiResponse({ task }, "Task completed").send(res);
});

// ============================================
// ASSIGNMENT
// ============================================

export const assignTask = asyncHandler(async (req, res) => {
  const { userId } = req.body;
  const businessId = getBusinessId(req.user);

  const task = await Task.findOneAndUpdate(
    { _id: req.params.id, businessId },
    { assignedTo: userId },
    { new: true }
  ).populate("assignedTo", "name email avatar");

  if (!task) throw new ApiError("Task not found", 404);
  new ApiResponse({ task }, "Task assigned").send(res);
});

export const unassignTask = asyncHandler(async (req, res) => {
  const businessId = getBusinessId(req.user);

  const task = await Task.findOneAndUpdate(
    { _id: req.params.id, businessId },
    { $unset: { assignedTo: "" } },
    { new: true }
  );
  if (!task) throw new ApiError("Task not found", 404);
  new ApiResponse({ task }, "Task unassigned").send(res);
});

// ============================================
// TAGS
// ============================================

export const addTags = asyncHandler(async (req, res) => {
  const { tags } = req.body; // Expects array of strings
  const businessId = getBusinessId(req.user);

  const task = await Task.findOneAndUpdate(
    { _id: req.params.id, businessId },
    { $addToSet: { tags: { $each: tags } } },
    { new: true }
  );
  if (!task) throw new ApiError("Task not found", 404);
  new ApiResponse({ task }, "Tags added").send(res);
});

export const removeTags = asyncHandler(async (req, res) => {
  const { tags } = req.body;
  const businessId = getBusinessId(req.user);

  const task = await Task.findOneAndUpdate(
    { _id: req.params.id, businessId },
    { $pull: { tags: { $in: tags } } },
    { new: true }
  );
  if (!task) throw new ApiError("Task not found", 404);
  new ApiResponse({ task }, "Tags removed").send(res);
});

// ============================================
// ARCHIVE
// ============================================

export const archiveTask = asyncHandler(async (req, res) => {
  const businessId = getBusinessId(req.user);

  const task = await Task.findOneAndUpdate(
    { _id: req.params.id, businessId },
    { isArchived: true },
    { new: true }
  );
  if (!task) throw new ApiError("Task not found", 404);
  new ApiResponse({ task }, "Task archived").send(res);
});

export const unarchiveTask = asyncHandler(async (req, res) => {
  const businessId = getBusinessId(req.user);

  const task = await Task.findOneAndUpdate(
    { _id: req.params.id, businessId },
    { isArchived: false },
    { new: true }
  );
  if (!task) throw new ApiError("Task not found", 404);
  new ApiResponse({ task }, "Task unarchived").send(res);
});

export const getArchivedTasks = asyncHandler(async (req, res) => {
  const businessId = getBusinessId(req.user);

  const tasks = await Task.find({
    businessId,
    isArchived: true,
  }).populate("assignedTo", "name email avatar");
  new ApiResponse({ tasks }).send(res);
});

// ============================================
// SUBTASKS
// ============================================

export const addSubtask = asyncHandler(async (req, res) => {
  const { title } = req.body;
  const businessId = getBusinessId(req.user);

  const task = await Task.findOne({ _id: req.params.id, businessId });
  if (!task) throw new ApiError("Task not found", 404);

  task.subtasks.push({ title, completed: false });
  await task.save();
  new ApiResponse({ task }, "Subtask added").send(res);
});

export const updateSubtask = asyncHandler(async (req, res) => {
  const { subtaskId } = req.params;
  const { title } = req.body;
  const businessId = getBusinessId(req.user);
  
  const task = await Task.findOne({ _id: req.params.id, businessId });
  if (!task) throw new ApiError("Task not found", 404);
  
  const subtask = task.subtasks.id(subtaskId);
  if (!subtask) throw new ApiError("Subtask not found", 404);
  
  if(title) subtask.title = title;
  await task.save();
  
  new ApiResponse({ task }, "Subtask updated").send(res);
});

export const toggleSubtask = asyncHandler(async (req, res) => {
  const { subtaskId } = req.params;
  const businessId = getBusinessId(req.user);

  const task = await Task.findOne({ _id: req.params.id, businessId });
  if (!task) throw new ApiError("Task not found", 404);

  const subtask = task.subtasks.id(subtaskId);
  if (!subtask) throw new ApiError("Subtask not found", 404);

  subtask.completed = !subtask.completed;
  await task.save();

  new ApiResponse({ task }, "Subtask toggled").send(res);
});

export const deleteSubtask = asyncHandler(async (req, res) => {
  const { subtaskId } = req.params;
  const businessId = getBusinessId(req.user);

  const task = await Task.findOne({ _id: req.params.id, businessId });
  if (!task) throw new ApiError("Task not found", 404);

  task.subtasks.pull(subtaskId);
  await task.save();

  new ApiResponse({ task }, "Subtask deleted").send(res);
});

// ============================================
// VIEWS & STATS
// ============================================

export const getTaskBoard = asyncHandler(async (req, res) => {
  const businessId = getBusinessId(req.user);

  const tasks = await Task.find({ businessId, isArchived: false })
    .populate("assignedTo", "name email avatar")
    .sort({ priority: -1 });

  const board = {
    pending: tasks.filter((t) => t.status === "pending"),
    todo: tasks.filter((t) => t.status === "todo"),
    in_progress: tasks.filter((t) => t.status === "in_progress"),
    blocked: tasks.filter((t) => t.status === "blocked"),
    completed: tasks.filter((t) => t.status === "completed"),
    cancelled: tasks.filter((t) => t.status === "cancelled"),
  };

  new ApiResponse({ board }).send(res);
});

export const getTaskStats = asyncHandler(async (req, res) => {
  const businessId = getBusinessId(req.user);

  const stats = await Task.aggregate([
    { 
      $match: { 
        businessId: new mongoose.Types.ObjectId(businessId), // Ensure ID type consistency
        isArchived: false 
      } 
    },
    { $group: { _id: "$status", count: { $sum: 1 } } }
  ]);
  new ApiResponse({ stats }).send(res);
});

export const getMyTasks = asyncHandler(async (req, res) => {
  const businessId = getBusinessId(req.user);

  const tasks = await Task.find({
    businessId,
    assignedTo: req.user._id,
    isArchived: false
  });
  new ApiResponse({ tasks }).send(res);
});

export const getOverdueTasks = asyncHandler(async (req, res) => {
  const businessId = getBusinessId(req.user);

  const tasks = await Task.find({
    businessId,
    dueDate: { $lt: new Date() },
    status: { $nin: ["completed", "cancelled"] },
    isArchived: false
  });
  new ApiResponse({ tasks }).send(res);
});

export const getDueTodayTasks = asyncHandler(async (req, res) => {
  const businessId = getBusinessId(req.user);

  const start = new Date();
  start.setHours(0,0,0,0);
  const end = new Date();
  end.setHours(23,59,59,999);
  
  const tasks = await Task.find({
    businessId,
    dueDate: { $gte: start, $lte: end },
    isArchived: false
  });
  new ApiResponse({ tasks }).send(res);
});

export const getUpcomingTasks = asyncHandler(async (req, res) => {
  const businessId = getBusinessId(req.user);

  const tasks = await Task.find({
    businessId,
    dueDate: { $gt: new Date() },
    isArchived: false
  }).limit(10);
  new ApiResponse({ tasks }).send(res);
});

export const searchTasks = asyncHandler(async (req, res) => {
  const { q } = req.query;
  const businessId = getBusinessId(req.user);

  const tasks = await Task.find({
    businessId,
    isArchived: false,
    $text: { $search: q }
  });
  new ApiResponse({ tasks }).send(res);
});