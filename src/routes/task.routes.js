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
import { checkPermission } from "../middleware/checkPermission.js";

const router = express.Router();

// Apply authentication middleware to all routes (Populates req.user.businessId)
router.use(authenticate);

// ============================================
// SPECIALIZED VIEWS & STATS (Must be before /:id)
// ============================================

router.get(
  "/stats", 
  checkPermission("tasks.read.all"), 
  getTaskStats
);
router.get(
  "/board", 
  checkPermission("tasks.read.all"), 
  getTaskBoard
);
router.get(
  "/my", 
  checkPermission("tasks.read.all"), 
  getMyTasks
);
router.get(
  "/archived", 
  checkPermission("tasks.read.all"), 
  getArchivedTasks
);
router.get(
  "/overdue", 
  checkPermission("tasks.read.all"), 
  getOverdueTasks
);
router.get(
  "/due-today", 
  checkPermission("tasks.read.all"), 
  getDueTodayTasks
);
router.get(
  "/upcoming", 
  checkPermission("tasks.read.all"), 
  getUpcomingTasks
);
router.get(
  "/search", 
  checkPermission("tasks.read.all"), 
  searchTasks
);

// ============================================
// BULK OPERATIONS
// ============================================

router.post(
  "/bulk-delete", 
  checkPermission("tasks.delete.all"), 
  bulkDeleteTasks
);

// ============================================
// ROOT ROUTES (List & Create)
// ============================================

router.route("/")
  .get(
    checkPermission("tasks.read.all"), 
    getTasks
  )
  .post(
    checkPermission("tasks.create"), 
    createTask
  );

// ============================================
// SPECIFIC TASK OPERATIONS (Using :id)
// ============================================

// Status Management
router.patch(
  "/:id/status", 
  checkPermission("tasks.update.all"), 
  updateStatus
);
router.post(
  "/:id/complete", 
  checkPermission("tasks.update.all"), 
  completeTask
);

// Assignment
router.patch(
  "/:id/assign", 
  checkPermission("tasks.update.all"), 
  assignTask
);
router.patch(
  "/:id/unassign", 
  checkPermission("tasks.update.all"), 
  unassignTask
);

// Tags
router.post(
  "/:id/tags", 
  checkPermission("tasks.update.all"), 
  addTags
);
router.delete(
  "/:id/tags", 
  checkPermission("tasks.update.all"), 
  removeTags
);

// Archive / Restore
router.post(
  "/:id/archive", 
  checkPermission("tasks.delete.all"), 
  archiveTask
);
router.post(
  "/:id/unarchive", 
  checkPermission("tasks.update.all"), 
  unarchiveTask
);

// Subtasks
router.post(
  "/:id/subtasks", 
  checkPermission("tasks.update.all"), 
  addSubtask
);

router.route("/:id/subtasks/:subtaskId")
  .put(
    checkPermission("tasks.update.all"), 
    updateSubtask
  )
  .delete(
    checkPermission("tasks.update.all"), 
    deleteSubtask
  );

router.patch(
  "/:id/subtasks/:subtaskId/toggle", 
  checkPermission("tasks.update.all"), 
  toggleSubtask
);

// ============================================
// GENERIC ID ROUTES (Get, Update, Delete)
// ============================================
// These must be last so they don't catch other specific routes

router.route("/:id")
  .get(
    checkPermission("tasks.read.all"), 
    getTask
  )
  .put(
    checkPermission("tasks.update.all"), 
    updateTask
  )
  .delete(
    checkPermission("tasks.delete.all"), 
    deleteTask
  );

export default router;