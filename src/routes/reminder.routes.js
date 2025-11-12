import express from "express";
import {
  getReminders,
  getReminder,
  createReminder,
  updateReminder,
  deleteReminder,
  snoozeReminder,
  getUpcomingReminders,
  restoreReminder,
  getArchivedReminders,
  bulkArchiveReminders,
  bulkRestoreReminders,
  completeReminder,
  cancelReminder,
} from "../controllers/reminderController.js";
import { authenticate } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";
import { param, body, query } from "express-validator";
import validateRequest from "../middleware/validateRequest.js";

const router = express.Router();

router.use(authenticate);

// Upcoming reminders
router.get(
  "/upcoming",
  checkPermission("reminders.read.all"),
  [
    query("days").optional().isInt({ min: 1, max: 30 }).withMessage("Days must be between 1 and 30")
  ],
  validateRequest,
  getUpcomingReminders
);

// Archived reminders
router.get(
  "/archived", 
  checkPermission("reminders.read.all"),
  [
    query("page").optional().isInt({ min: 1 }).withMessage("Page must be a positive integer"),
    query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Limit must be between 1 and 100"),
    query("type").optional().isIn(["event", "payment", "task", "maintenance", "followup", "other"]).withMessage("Invalid reminder type"),
    query("sortBy").optional().isIn(["archivedAt", "reminderDate", "title"]).withMessage("Invalid sort field"),
    query("sortOrder").optional().isIn(["asc", "desc"]).withMessage("Sort order must be asc or desc")
  ],
  validateRequest,
  getArchivedReminders
);

// Bulk operations
router.post(
  "/bulk-archive", 
  checkPermission("reminders.delete.all"),
  [
    body("ids").isArray().withMessage("IDs must be an array"),
    body("ids.*").isMongoId().withMessage("Invalid reminder ID")
  ],
  validateRequest,
  bulkArchiveReminders
);

router.post(
  "/bulk-restore", 
  checkPermission("reminders.update.all"),
  [
    body("ids").isArray().withMessage("IDs must be an array"),
    body("ids.*").isMongoId().withMessage("Invalid reminder ID")
  ],
  validateRequest,
  bulkRestoreReminders
);

// Snooze
router.post(
  "/:id/snooze",
  [
    param("id").isMongoId().withMessage("Invalid reminder ID"),
    body("snoozeUntil").isISO8601().withMessage("Invalid snooze date")
  ],
  validateRequest,
  snoozeReminder
);

// Restore archived reminder
router.patch(
  "/:id/restore",
  checkPermission("reminders.update.all"),
  [
    param("id").isMongoId().withMessage("Invalid reminder ID")
  ],
  validateRequest,
  restoreReminder
);

// Complete reminder
router.post(
  "/:id/complete",
  checkPermission("reminders.update.all"),
  [
    param("id").isMongoId().withMessage("Invalid reminder ID")
  ],
  validateRequest,
  completeReminder
);

// Cancel reminder
router.post(
  "/:id/cancel",
  checkPermission("reminders.update.all"),
  [
    param("id").isMongoId().withMessage("Invalid reminder ID")
  ],
  validateRequest,
  cancelReminder
);

// CRUD operations
router
  .route("/")
  .get(
    checkPermission("reminders.read.all"),
    [
      query("page").optional().isInt({ min: 1 }).withMessage("Page must be a positive integer"),
      query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Limit must be between 1 and 100"),
      query("type").optional().isIn(["event", "payment", "task", "maintenance", "followup", "other"]).withMessage("Invalid reminder type"),
      query("priority").optional().isIn(["low", "medium", "high", "urgent"]).withMessage("Invalid priority"),
      query("status").optional().isIn(["active", "completed", "snoozed", "cancelled"]).withMessage("Invalid status"),
      query("startDate").optional().isISO8601().withMessage("Invalid start date"),
      query("endDate").optional().isISO8601().withMessage("Invalid end date"),
      query("isArchived").optional().isBoolean().withMessage("isArchived must be a boolean")
    ],
    validateRequest,
    getReminders
  )
  .post(
    checkPermission("reminders.create"),
    [
      body("title").notEmpty().withMessage("Title is required").isLength({ max: 200 }).withMessage("Title cannot exceed 200 characters"),
      body("reminderDate").isISO8601().withMessage("Invalid reminder date"),
      body("reminderTime").notEmpty().withMessage("Reminder time is required"),
      body("type").optional().isIn(["event", "payment", "task", "maintenance", "followup", "other"]).withMessage("Invalid reminder type"),
      body("priority").optional().isIn(["low", "medium", "high", "urgent"]).withMessage("Invalid priority")
    ],
    validateRequest,
    createReminder
  );

router
  .route("/:id")
  .get(
    checkPermission("reminders.read.all"),
    [
      param("id").isMongoId().withMessage("Invalid reminder ID")
    ],
    validateRequest,
    getReminder
  )
  .put(
    checkPermission("reminders.update.all"),
    [
      param("id").isMongoId().withMessage("Invalid reminder ID"),
      body("title").optional().isLength({ max: 200 }).withMessage("Title cannot exceed 200 characters"),
      body("type").optional().isIn(["event", "payment", "task", "maintenance", "followup", "other"]).withMessage("Invalid reminder type"),
      body("priority").optional().isIn(["low", "medium", "high", "urgent"]).withMessage("Invalid priority"),
      body("status").optional().isIn(["active", "completed", "snoozed", "cancelled"]).withMessage("Invalid status")
    ],
    validateRequest,
    updateReminder
  )
  .delete(
    checkPermission("reminders.delete.all"),
    [
      param("id").isMongoId().withMessage("Invalid reminder ID")
    ],
    validateRequest,
    deleteReminder
  );

export default router;