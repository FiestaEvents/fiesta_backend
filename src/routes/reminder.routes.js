import express from "express";
import {
  getReminders,
  getReminder,
  createReminder,
  updateReminder,
  deleteReminder, // Actually archives
  toggleComplete, // Simplified complete/uncomplete
  getUpcomingReminders,
} from "../controllers/reminderController.js";
import { authenticate } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";
import { param, body, query } from "express-validator";
import validateRequest from "../middleware/validateRequest.js";

const router = express.Router();

router.use(authenticate);

// 1. Get List (Dashboard/List View)
router.get(
  "/",
  checkPermission("reminders.read.all"),
  [
    query("status").optional().isIn(["active", "completed"]).withMessage("Invalid status"),
    query("startDate").optional().isISO8601(),
    query("endDate").optional().isISO8601()
  ],
  validateRequest,
  getReminders
);

// 2. Upcoming (For TopBar Notification Badge)
router.get(
  "/upcoming",
  checkPermission("reminders.read.all"),
  getUpcomingReminders
);

// 3. Create
router.post(
  "/",
  checkPermission("reminders.create"),
  [
    body("title").notEmpty().withMessage("Title is required"),
    body("reminderDate").isISO8601().withMessage("Invalid date"),
    body("reminderTime").notEmpty().withMessage("Time is required")
  ],
  validateRequest,
  createReminder
);

// 4. Toggle Complete (Check/Uncheck)
router.patch(
  "/:id/toggle-complete",
  checkPermission("reminders.update.all"),
  [param("id").isMongoId()],
  validateRequest,
  toggleComplete
);

// 5. Get One, Update, Delete (Archive)
router
  .route("/:id")
  .get(checkPermission("reminders.read.all"), getReminder)
  .put(
    checkPermission("reminders.update.all"),
    [
      body("title").optional().notEmpty(),
      body("reminderDate").optional().isISO8601()
    ],
    validateRequest,
    updateReminder
  )
  .delete(
    checkPermission("reminders.delete.all"), // This is Archive
    deleteReminder
  );

export default router;