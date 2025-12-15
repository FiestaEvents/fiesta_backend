// routes/reminderRoutes.js - COMPLETE VERSION
import express from "express";
import {
  getReminders,
  getReminder,
  createReminder,
  updateReminder,
  deleteReminder,
  toggleComplete,
  snoozeReminder,
  getUpcomingReminders,
  dismissReminder,
  getReminderStats,
} from "../controllers/reminderController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

// ============================================
// SPECIAL ROUTES (Must come BEFORE /:id routes)
// ============================================
router.get("/upcoming", authenticate, getUpcomingReminders);
router.get("/stats", authenticate, getReminderStats);

// ============================================
// MAIN CRUD ROUTES
// ============================================
router.route("/") .get(authenticate, getReminders).post(authenticate, createReminder);

// ============================================
// ACTION ROUTES (Specific ID operations)
// ============================================
router.post("/:id/snooze", authenticate, snoozeReminder);
router.post("/:id/dismiss", authenticate, dismissReminder);
router.patch("/:id/toggle-complete", authenticate, toggleComplete);

// ============================================
// STANDARD ID ROUTES (Must come LAST)
// ============================================
router.route("/:id")
  .get(authenticate, getReminder)
  .put(authenticate, updateReminder)
  .delete(authenticate, deleteReminder);

export default router;