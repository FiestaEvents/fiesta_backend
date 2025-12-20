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
import { checkPermission } from "../middleware/checkPermission.js";
import validateRequest from "../middleware/validateRequest.js";
import {
  createReminderValidator,
  updateReminderValidator,
  reminderIdValidator,
  snoozeReminderValidator,
} from "../validators/reminderValidator.js";

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// ============================================
// SPECIAL ROUTES (Must come BEFORE /:id)
// ============================================

// Get Upcoming (Dashboard/Widget)
router.get(
  "/upcoming", 
  // checkPermission("reminders.read.own"), // Usually allowed for everyone with basic read access
  getUpcomingReminders
);

// Statistics
router.get(
  "/stats", 
  checkPermission("reminders.read.all"), 
  getReminderStats
);

// ============================================
// ACTION ROUTES (Specific ID operations)
// ============================================

router.post(
  "/:id/snooze",
  checkPermission("reminders.update.own"), // Or .all depending on policy
  snoozeReminderValidator,
  validateRequest,
  snoozeReminder
);

router.post(
  "/:id/dismiss",
  checkPermission("reminders.update.own"),
  reminderIdValidator,
  validateRequest,
  dismissReminder
);

router.patch(
  "/:id/toggle-complete",
  checkPermission("reminders.update.own"),
  reminderIdValidator,
  validateRequest,
  toggleComplete
);

// ============================================
// MAIN CRUD ROUTES
// ============================================

router
  .route("/")
  .get(
    checkPermission("reminders.read.all"),
    getReminders
  )
  .post(
    checkPermission("reminders.create"),
    createReminderValidator,
    validateRequest,
    createReminder
  );

router
  .route("/:id")
  .get(
    checkPermission("reminders.read.all"),
    reminderIdValidator,
    validateRequest,
    getReminder
  )
  .put(
    checkPermission("reminders.update.all"),
    updateReminderValidator,
    validateRequest,
    updateReminder
  )
  .delete(
    checkPermission("reminders.delete.all"),
    reminderIdValidator,
    validateRequest,
    deleteReminder
  );

export default router;