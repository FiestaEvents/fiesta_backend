import express from "express";
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  archiveUser,
  restoreUser,
  permanentDeleteUser,
  getUserStats,
  getArchivedUsers,
  bulkArchiveUsers,
  bulkRestoreUsers,
  getUserActivity,
} from "../controllers/userController.js";
import { authenticate } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";
import validateRequest from "../middleware/validateRequest.js";
import {
  createUserValidator,
  updateUserValidator,
  userIdValidator,
  archiveUserValidator,
  restoreUserValidator,
  permanentDeleteValidator,
  bulkArchiveValidator,
  bulkRestoreValidator,
  getUsersValidator,
  getArchivedUsersValidator,
} from "../validators/userValidator.js";

const router = express.Router();

// Apply authentication to all routes (Deep Populates permissions)
router.use(authenticate);

// ==========================================
// STATIC ROUTES (Must come before /:id)
// ==========================================

// Stats
router.get(
  "/stats", 
  checkPermission("users.read.all"), 
  getUserStats
);

// Archived Users List
router.get(
  "/archived/list",
  checkPermission("users.read.all"), // Using read permission to view list
  getArchivedUsersValidator,
  validateRequest,
  getArchivedUsers
);

// Bulk Operations
router.patch(
  "/bulk/archive",
  checkPermission("users.delete.all"),
  bulkArchiveValidator,
  validateRequest,
  bulkArchiveUsers
);

router.patch(
  "/bulk/restore",
  checkPermission("users.update.all"),
  bulkRestoreValidator,
  validateRequest,
  bulkRestoreUsers
);

// ==========================================
// MAIN USER ROUTES
// ==========================================

// Get All Users (with filters)
router.get(
  "/",
  checkPermission("users.read.all"),
  getUsersValidator,
  validateRequest,
  getUsers
);

// Create User (Direct admin creation)
router.post(
  "/",
  checkPermission("users.create"),
  createUserValidator,
  validateRequest,
  createUser
);

// ==========================================
// DYNAMIC ROUTES (/:id)
// ==========================================

// Get Single User
router.get(
  "/:id",
  checkPermission("users.read.all"),
  userIdValidator,
  validateRequest,
  getUserById
);

// Update User
router.put(
  "/:id",
  checkPermission("users.update.all"),
  updateUserValidator,
  validateRequest,
  updateUser
);

// Archive Single User
router.patch(
  "/:id/archive",
  checkPermission("users.delete.all"),
  archiveUserValidator,
  validateRequest,
  archiveUser
);

// Restore Single User
router.patch(
  "/:id/restore",
  checkPermission("users.update.all"),
  restoreUserValidator,
  validateRequest,
  restoreUser
);

// Permanent Delete
router.delete(
  "/:id/permanent",
  checkPermission("users.delete.all"),
  permanentDeleteValidator,
  validateRequest,
  permanentDeleteUser
);

router.get(
  "/:id/activity", checkPermission("users.read.all"), getUserActivity);
  
export default router;