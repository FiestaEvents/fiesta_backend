import express from "express";
import {
  // Basic CRUD
  getTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  bulkDeleteTasks,
  
  // Status
  updateStatus,
  completeTask,
  
  // Assignment
  assignTask,
  unassignTask,
  
  // Tags
  addTags,
  removeTags,
  
  // Archive
  archiveTask,
  unarchiveTask,
  getArchivedTasks,
  
  // Subtasks
  addSubtask,
  updateSubtask,
  toggleSubtask,
  deleteSubtask,
  
  // Views & Stats
  getTaskBoard,
  getTaskStats,
  getMyTasks,
  getOverdueTasks,
  getDueTodayTasks,
  getUpcomingTasks,
  searchTasks
} from "../controllers/taskController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// ============================================
// SPECIALIZED VIEWS & STATS (Must be before /:id)
// ============================================
router.get("/stats", getTaskStats);
router.get("/board", getTaskBoard);
router.get("/my", getMyTasks);
router.get("/archived", getArchivedTasks);
router.get("/overdue", getOverdueTasks);
router.get("/due-today", getDueTodayTasks);
router.get("/upcoming", getUpcomingTasks);
router.get("/search", searchTasks);

// ============================================
// BULK OPERATIONS
// ============================================
router.post("/bulk-delete", bulkDeleteTasks);

// ============================================
// ROOT ROUTES (List & Create)
// ============================================
router.route("/")
  .get(getTasks)
  .post(createTask);

// ============================================
// SPECIFIC TASK OPERATIONS (Using :id)
// ============================================

// Status Management
router.patch("/:id/status", updateStatus);
router.post("/:id/complete", completeTask);

// Assignment
router.patch("/:id/assign", assignTask);
router.patch("/:id/unassign", unassignTask);

// Tags
router.post("/:id/tags", addTags);
router.delete("/:id/tags", removeTags);

// Archive / Restore
router.post("/:id/archive", archiveTask);
router.post("/:id/unarchive", unarchiveTask);

// Subtasks
router.post("/:id/subtasks", addSubtask);
router.route("/:id/subtasks/:subtaskId")
  .put(updateSubtask)
  .delete(deleteSubtask);
router.patch("/:id/subtasks/:subtaskId/toggle", toggleSubtask);

// ============================================
// GENERIC ID ROUTES (Get, Update, Delete)
// ============================================
// These must be last so they don't catch other specific routes
router.route("/:id")
  .get(getTask)
  .put(updateTask)
  .delete(deleteTask);

export default router;