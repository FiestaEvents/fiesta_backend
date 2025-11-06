import express from "express";
import { param, body, query } from "express-validator";
import { authenticate } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";
import validateRequest from "../middleware/validateRequest.js";

// Import all controller functions
import {
  // Basic CRUD
  getTasks,
  getTask,
  createTask,
  updateTask,
  patchTask,
  deleteTask,
  bulkDeleteTasks,
  
  // Status Management
  updateStatus,
  completeTask,
  cancelTask,
  blockTask,
  unblockTask,
  
  // Assignment & Collaboration
  assignTask,
  unassignTask,
  addWatcher,
  removeWatcher,
  
  // Comments
  addComment,
  editComment,
  deleteComment,
  
  // Subtasks
  addSubtask,
  updateSubtask,
  toggleSubtask,
  deleteSubtask,
  reorderSubtasks,
  
  // Attachments
  addAttachment,
  deleteAttachment,
  
  // Tags
  addTags,
  removeTags,
  
  // Dependencies
  addDependency,
  removeDependency,
  
  // Progress Tracking
  updateProgress,
  logTime,
  
  // Archive & Restore
  archiveTask,
  unarchiveTask,
  getArchivedTasks,
  
  // Views & Filters
  getTaskBoard,
  getMyTasks,
  getOverdueTasks,
  getDueTodayTasks,
  getUpcomingTasks,
  getTasksByEvent,
  getTasksByClient,
  getTasksByPartner,
  searchTasks,
  
  // Statistics & Analytics
  getTaskStats,
  getCompletionRate,
  getDistribution,
  getUserProductivity,
  
  // Bulk Operations
  bulkUpdateTasks,
  bulkAssignTasks,
  bulkCompleteTasks,
  bulkArchiveTasks,
  
  // Duplicate & Export
  duplicateTask,
  exportTasks,
} from "../controllers/taskController.js";

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// ============================================
// STATISTICS & ANALYTICS ROUTES
// ============================================
router.get(
  "/stats",
  checkPermission("tasks.read.all"),
  getTaskStats
);

router.get(
  "/analytics/completion-rate",
  checkPermission("tasks.read.all"),
  query("startDate").optional().isISO8601(),
  query("endDate").optional().isISO8601(),
  query("groupBy").optional().isIn(["day", "week", "month"]),
  validateRequest,
  getCompletionRate
);

router.get(
  "/analytics/distribution",
  checkPermission("tasks.read.all"),
  query("groupBy").optional().isIn(["status", "priority", "category", "assignedTo"]),
  validateRequest,
  getDistribution
);

router.get(
  "/analytics/me",
  query("startDate").optional().isISO8601(),
  query("endDate").optional().isISO8601(),
  validateRequest,
  getUserProductivity
);

// ============================================
// SPECIAL VIEW ROUTES
// ============================================
router.get("/board", getTaskBoard);

router.get("/my", getMyTasks);

router.get(
  "/archived",
  checkPermission("tasks.read.all"),
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
  validateRequest,
  getArchivedTasks
);

router.get(
  "/overdue",
  checkPermission("tasks.read.all"),
  getOverdueTasks
);

router.get(
  "/due-today",
  getDueTodayTasks
);

router.get(
  "/upcoming",
  query("days").optional().isInt({ min: 1, max: 90 }),
  validateRequest,
  getUpcomingTasks
);

router.get(
  "/event/:eventId",
  param("eventId").isMongoId(),
  validateRequest,
  getTasksByEvent
);

router.get(
  "/client/:clientId",
  param("clientId").isMongoId(),
  validateRequest,
  getTasksByClient
);

router.get(
  "/partner/:partnerId",
  param("partnerId").isMongoId(),
  validateRequest,
  getTasksByPartner
);

router.get(
  "/search",
  query("q").notEmpty().withMessage("Search query is required"),
  validateRequest,
  searchTasks
);

// ============================================
// EXPORT ROUTES
// ============================================
router.get(
  "/export",
  checkPermission("tasks.export"),
  query("format").optional().isIn(["csv", "json"]),
  validateRequest,
  exportTasks
);

// ============================================
// BULK OPERATIONS ROUTES
// ============================================
router.post(
  "/bulk-delete",
  checkPermission("tasks.delete.all"),
  body("ids").isArray({ min: 1 }).withMessage("Task IDs array is required"),
  body("ids.*").isMongoId().withMessage("Invalid task ID"),
  validateRequest,
  bulkDeleteTasks
);

router.patch(
  "/bulk-update",
  checkPermission("tasks.update.all"),
  body("ids").isArray({ min: 1 }).withMessage("Task IDs array is required"),
  body("ids.*").isMongoId().withMessage("Invalid task ID"),
  body("data").isObject().withMessage("Update data is required"),
  validateRequest,
  bulkUpdateTasks
);

router.patch(
  "/bulk-assign",
  checkPermission("tasks.update.all"),
  body("ids").isArray({ min: 1 }).withMessage("Task IDs array is required"),
  body("ids.*").isMongoId().withMessage("Invalid task ID"),
  body("userId").isMongoId().withMessage("Valid user ID is required"),
  validateRequest,
  bulkAssignTasks
);

router.post(
  "/bulk-complete",
  checkPermission("tasks.update.all"),
  body("ids").isArray({ min: 1 }).withMessage("Task IDs array is required"),
  body("ids.*").isMongoId().withMessage("Invalid task ID"),
  validateRequest,
  bulkCompleteTasks
);

router.post(
  "/bulk-archive",
  checkPermission("tasks.update.all"),
  body("ids").isArray({ min: 1 }).withMessage("Task IDs array is required"),
  body("ids.*").isMongoId().withMessage("Invalid task ID"),
  validateRequest,
  bulkArchiveTasks
);

// ============================================
// TASK-SPECIFIC ROUTES (require :id)
// ============================================

// Status Management
router.patch(
  "/:id/status",
  param("id").isMongoId(),
  body("status")
    .isIn(["pending", "todo", "in_progress", "completed", "cancelled", "blocked"])
    .withMessage("Invalid status"),
  body("blockedReason")
    .if(body("status").equals("blocked"))
    .notEmpty()
    .withMessage("Blocked reason is required"),
  body("cancellationReason")
    .if(body("status").equals("cancelled"))
    .notEmpty()
    .withMessage("Cancellation reason is required"),
  validateRequest,
  updateStatus
);

router.post(
  "/:id/complete",
  param("id").isMongoId(),
  validateRequest,
  completeTask
);

router.post(
  "/:id/cancel",
  param("id").isMongoId(),
  body("reason").notEmpty().withMessage("Cancellation reason is required"),
  validateRequest,
  cancelTask
);

router.post(
  "/:id/block",
  param("id").isMongoId(),
  body("reason").notEmpty().withMessage("Blocked reason is required"),
  validateRequest,
  blockTask
);

router.post(
  "/:id/unblock",
  param("id").isMongoId(),
  validateRequest,
  unblockTask
);

// Assignment & Collaboration
router.patch(
  "/:id/assign",
  param("id").isMongoId(),
  body("userId").isMongoId().withMessage("Valid user ID is required"),
  validateRequest,
  assignTask
);

router.patch(
  "/:id/unassign",
  param("id").isMongoId(),
  validateRequest,
  unassignTask
);

router.post(
  "/:id/watchers",
  param("id").isMongoId(),
  body("userId").isMongoId().withMessage("Valid user ID is required"),
  validateRequest,
  addWatcher
);

router.delete(
  "/:id/watchers/:userId",
  param("id").isMongoId(),
  param("userId").isMongoId(),
  validateRequest,
  removeWatcher
);

// Comments
router.post(
  "/:id/comments",
  param("id").isMongoId(),
  body("text")
    .notEmpty()
    .withMessage("Comment text is required")
    .isLength({ max: 1000 })
    .withMessage("Comment cannot exceed 1000 characters"),
  body("mentions")
    .optional()
    .isArray()
    .withMessage("Mentions must be an array"),
  body("mentions.*")
    .optional()
    .isMongoId()
    .withMessage("Invalid user ID in mentions"),
  validateRequest,
  addComment
);

router.put(
  "/:id/comments/:commentId",
  param("id").isMongoId(),
  param("commentId").isMongoId(),
  body("text")
    .notEmpty()
    .withMessage("Comment text is required")
    .isLength({ max: 1000 })
    .withMessage("Comment cannot exceed 1000 characters"),
  validateRequest,
  editComment
);

router.delete(
  "/:id/comments/:commentId",
  param("id").isMongoId(),
  param("commentId").isMongoId(),
  validateRequest,
  deleteComment
);

// Subtasks
router.post(
  "/:id/subtasks",
  param("id").isMongoId(),
  body("title")
    .notEmpty()
    .withMessage("Subtask title is required")
    .isLength({ max: 200 })
    .withMessage("Title cannot exceed 200 characters"),
  body("description")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Description cannot exceed 500 characters"),
  validateRequest,
  addSubtask
);

router.put(
  "/:id/subtasks/:subtaskId",
  param("id").isMongoId(),
  param("subtaskId").isMongoId(),
  body("title")
    .optional()
    .isLength({ max: 200 })
    .withMessage("Title cannot exceed 200 characters"),
  body("description")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Description cannot exceed 500 characters"),
  validateRequest,
  updateSubtask
);

router.patch(
  "/:id/subtasks/:subtaskId/toggle",
  param("id").isMongoId(),
  param("subtaskId").isMongoId(),
  validateRequest,
  toggleSubtask
);

router.delete(
  "/:id/subtasks/:subtaskId",
  param("id").isMongoId(),
  param("subtaskId").isMongoId(),
  validateRequest,
  deleteSubtask
);

router.patch(
  "/:id/subtasks/reorder",
  param("id").isMongoId(),
  body("subtasks")
    .isArray({ min: 1 })
    .withMessage("Subtasks array is required"),
  body("subtasks.*.id")
    .isMongoId()
    .withMessage("Invalid subtask ID"),
  body("subtasks.*.order")
    .isInt({ min: 0 })
    .withMessage("Order must be a non-negative integer"),
  validateRequest,
  reorderSubtasks
);

// Attachments
router.post(
  "/:id/attachments",
  param("id").isMongoId(),
  body("fileName").notEmpty().withMessage("File name is required"),
  body("fileUrl").notEmpty().isURL().withMessage("Valid file URL is required"),
  body("fileSize").optional().isInt({ min: 0 }),
  body("fileType").optional().isString(),
  validateRequest,
  addAttachment
);

router.delete(
  "/:id/attachments/:attachmentId",
  param("id").isMongoId(),
  param("attachmentId").isMongoId(),
  validateRequest,
  deleteAttachment
);

// Tags
router.post(
  "/:id/tags",
  param("id").isMongoId(),
  body("tags")
    .isArray({ min: 1 })
    .withMessage("Tags array is required"),
  body("tags.*")
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Each tag must be a non-empty string"),
  validateRequest,
  addTags
);

router.delete(
  "/:id/tags",
  param("id").isMongoId(),
  body("tags")
    .isArray({ min: 1 })
    .withMessage("Tags array is required"),
  body("tags.*")
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Each tag must be a non-empty string"),
  validateRequest,
  removeTags
);

// Dependencies
router.post(
  "/:id/dependencies",
  param("id").isMongoId(),
  body("dependencyTaskId")
    .isMongoId()
    .withMessage("Valid dependency task ID is required"),
  body("type")
    .optional()
    .isIn(["blocks", "blocked_by", "relates_to"])
    .withMessage("Invalid dependency type"),
  validateRequest,
  addDependency
);

router.delete(
  "/:id/dependencies/:dependencyId",
  param("id").isMongoId(),
  param("dependencyId").isMongoId(),
  validateRequest,
  removeDependency
);

// Progress Tracking
router.patch(
  "/:id/progress",
  param("id").isMongoId(),
  body("progress")
    .isInt({ min: 0, max: 100 })
    .withMessage("Progress must be between 0 and 100"),
  validateRequest,
  updateProgress
);

router.post(
  "/:id/time-log",
  param("id").isMongoId(),
  body("hours")
    .isFloat({ min: 0.1 })
    .withMessage("Hours must be a positive number"),
  body("description")
    .optional()
    .isString()
    .withMessage("Description must be a string"),
  validateRequest,
  logTime
);

// Archive & Restore
router.post(
  "/:id/archive",
  param("id").isMongoId(),
  validateRequest,
  archiveTask
);

router.post(
  "/:id/unarchive",
  param("id").isMongoId(),
  validateRequest,
  unarchiveTask
);

// Duplicate
router.post(
  "/:id/duplicate",
  checkPermission("tasks.create"),
  param("id").isMongoId(),
  validateRequest,
  duplicateTask
);

// ============================================
// BASIC CRUD ROUTES
// ============================================
router
  .route("/")
  .get(
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("status").optional().isString(),
    query("priority").optional().isIn(["low", "medium", "high", "urgent"]),
    query("category").optional().isString(),
    query("assignedTo").optional().isMongoId(),
    query("dueDateStart").optional().isISO8601(),
    query("dueDateEnd").optional().isISO8601(),
    query("search").optional().isString(),
    query("tags").optional(),
    query("isArchived").optional().isBoolean(),
    query("sortBy").optional().isString(),
    query("sortOrder").optional().isIn(["asc", "desc"]),
    validateRequest,
    getTasks
  )
  .post(
    checkPermission("tasks.create"),
    body("title")
      .notEmpty()
      .withMessage("Task title is required")
      .isLength({ max: 200 })
      .withMessage("Title cannot exceed 200 characters"),
    body("description")
      .optional()
      .isLength({ max: 2000 })
      .withMessage("Description cannot exceed 2000 characters"),
    body("priority")
      .optional()
      .isIn(["low", "medium", "high", "urgent"])
      .withMessage("Invalid priority"),
    body("status")
      .optional()
      .isIn(["pending", "todo", "in_progress", "completed", "cancelled", "blocked"])
      .withMessage("Invalid status"),
    body("category")
      .optional()
      .isIn([
        "event_preparation",
        "marketing",
        "maintenance",
        "client_followup",
        "partner_coordination",
        "administrative",
        "finance",
        "setup",
        "cleanup",
        "other",
      ])
      .withMessage("Invalid category"),
    body("dueDate")
      .notEmpty()
      .withMessage("Due date is required")
      .isISO8601()
      .withMessage("Invalid due date format"),
    body("startDate")
      .optional()
      .isISO8601()
      .withMessage("Invalid start date format"),
    body("reminderDate")
      .optional()
      .isISO8601()
      .withMessage("Invalid reminder date format"),
    body("estimatedHours")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("Estimated hours must be a positive number"),
    body("assignedTo")
      .optional()
      .isMongoId()
      .withMessage("Invalid assignee ID"),
    body("watchers")
      .optional()
      .isArray()
      .withMessage("Watchers must be an array"),
    body("watchers.*")
      .optional()
      .isMongoId()
      .withMessage("Invalid watcher ID"),
    body("relatedEvent")
      .optional()
      .isMongoId()
      .withMessage("Invalid event ID"),
    body("relatedClient")
      .optional()
      .isMongoId()
      .withMessage("Invalid client ID"),
    body("relatedPartner")
      .optional()
      .isMongoId()
      .withMessage("Invalid partner ID"),
    body("tags")
      .optional()
      .isArray()
      .withMessage("Tags must be an array"),
    validateRequest,
    createTask
  );

router
  .route("/:id")
  .get(
    param("id").isMongoId(),
    query("trackView").optional().isBoolean(),
    validateRequest,
    getTask
  )
  .put(
    checkPermission("tasks.update.all"),
    param("id").isMongoId(),
    body("title")
      .optional()
      .isLength({ max: 200 })
      .withMessage("Title cannot exceed 200 characters"),
    body("description")
      .optional()
      .isLength({ max: 2000 })
      .withMessage("Description cannot exceed 2000 characters"),
    body("priority")
      .optional()
      .isIn(["low", "medium", "high", "urgent"])
      .withMessage("Invalid priority"),
    body("status")
      .optional()
      .isIn(["pending", "todo", "in_progress", "completed", "cancelled", "blocked"])
      .withMessage("Invalid status"),
    body("dueDate")
      .optional()
      .isISO8601()
      .withMessage("Invalid due date format"),
    body("progress")
      .optional()
      .isInt({ min: 0, max: 100 })
      .withMessage("Progress must be between 0 and 100"),
    validateRequest,
    updateTask
  )
  .patch(
    param("id").isMongoId(),
    validateRequest,
    patchTask
  )
  .delete(
    checkPermission("tasks.delete.all"),
    param("id").isMongoId(),
    validateRequest,
    deleteTask
  );

export default router;