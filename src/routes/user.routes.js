// routes/users.js 
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
} from "../controllers/userController.js";
import { authenticate, authorize } from "../middleware/auth.js";
import validateRequest from "../middleware/validateRequest.js";
import {
  createUserValidator,
  updateUserValidator,
} from "../validators/userValidator.js";

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// Main user routes
router.get("/", authorize("users:read:team"), getUsers);
router.get("/stats", authorize("users:read:team"), getUserStats);
router.get("/:id", authorize("users:read:team"), getUserById);
router.post("/", authorize("users:create:team"), createUserValidator, validateRequest, createUser);
router.put("/:id", authorize("users:update:team"), updateUserValidator, validateRequest, updateUser);

// Archive routes
router.get("/archived/list", authorize("users:read:team"), getArchivedUsers);
router.patch("/:id/archive", authorize("users:delete:team"), archiveUser);
router.patch("/:id/restore", authorize("users:update:team"), restoreUser);
router.delete("/:id/permanent", authorize("users:delete:all"), permanentDeleteUser);

// Bulk archive operations
router.patch("/bulk/archive", authorize("users:delete:team"), bulkArchiveUsers);
router.patch("/bulk/restore", authorize("users:update:team"), bulkRestoreUsers);

export default router;