import express from "express";
import {
  getReminders,
  getReminder,
  createReminder,
  updateReminder,
  deleteReminder,
  snoozeReminder,
  getUpcomingReminders,
} from "../controllers/reminderController.js";
import { authenticate } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";
import { param, body } from "express-validator";
import validateRequest from "../middleware/validateRequest.js";

const router = express.Router();

router.use(authenticate);

// Upcoming reminders
router.get(
  "/upcoming",
  checkPermission("reminders.read.all"),
  getUpcomingReminders
);

// Snooze
router.post(
  "/:id/snooze",
  param("id").isMongoId(),
  body("snoozeUntil").isISO8601().withMessage("Invalid snooze date"),
  validateRequest,
  snoozeReminder
);

// CRUD operations
router
  .route("/")
  .get(checkPermission("reminders.read.all"), getReminders)
  .post(checkPermission("reminders.create"), createReminder);

router
  .route("/:id")
  .get(
    checkPermission("reminders.read.all"),
    param("id").isMongoId(),
    validateRequest,
    getReminder
  )
  .put(
    checkPermission("reminders.update.all"),
    param("id").isMongoId(),
    validateRequest,
    updateReminder
  )
  .delete(
    checkPermission("reminders.delete.all"),
    param("id").isMongoId(),
    validateRequest,
    deleteReminder
  );

export default router;