import { body, param } from "express-validator";
import { User } from "../models/index.js";

// =========================================================
// HELPERS
// =========================================================
const buildLocalDateTime = ({ date, reminderDate, reminderTime }) => {
  if (date) {
    const d = new Date(date);
    if (!isNaN(d.getTime())) return d;
  }

  if (reminderDate && reminderTime) {
    const [y, m, d] = reminderDate.split("-").map(Number);
    const [h, min] = reminderTime.split(":").map(Number);
    return new Date(y, m - 1, d, h, min, 0, 0); // LOCAL Construction
  }

  return null;
};

const validateReminderDateTime = (value, { req }) => {
  const finalDate = buildLocalDateTime({
    date: value,
    reminderDate: req.body.reminderDate,
    reminderTime: req.body.reminderTime,
  });

  // If this runs (Create context, or Update where date is provided), we expect a valid date
  if (!finalDate) {
    throw new Error("Reminder date and time are required");
  }

  if (isNaN(finalDate.getTime())) {
    throw new Error("Invalid reminder date or time");
  }

  const now = new Date();
  const MIN_DELAY_MS = 60 * 1000; // 1 minute buffer

  if (finalDate.getTime() < now.getTime() + MIN_DELAY_MS) {
    throw new Error("Reminder must be at least 1 minute from now");
  }

  // Normalize for controllers / Agenda (Side Effect safe in Validator)
  req.body.reminderDateTime = finalDate;

  // Ensure consistent format in body for downstream use
  req.body.reminderDate ??= finalDate.toISOString().slice(0, 10);
  req.body.reminderTime ??= `${String(finalDate.getHours()).padStart(2,"0")}:${String(finalDate.getMinutes()).padStart(2, "0")}`;

  return true;
};

// =========================================================
// COMMON RULES
// =========================================================
const rules = {
  id: param("id").isMongoId().withMessage("Invalid reminder ID"),

  title: body("title")
    .trim()
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ max: 200 })
    .withMessage("Title must be under 200 characters"),

  type: body("type")
    .optional()
    .isIn(["task", "payment", "event", "maintenance", "followup", "other"])
    .withMessage("Invalid reminder type"),

  priority: body("priority")
    .optional()
    .isIn(["low", "medium", "high", "urgent"])
    .withMessage("Invalid priority"),
    
  assignee: body("assignedTo")
    .optional()
    .isMongoId()
    .withMessage("Invalid Assignee ID")
    .custom(async (val, { req }) => {
      // ✅ TENANT ISOLATION CHECK
      const user = await User.findOne({ 
        _id: val, 
        businessId: req.user.businessId,
        isActive: true
      });
      if (!user) throw new Error("Assignee not found or does not belong to your business");
      return true;
    }),
};

// =========================================================
// EXPORTED VALIDATORS (MATCH ROUTES EXACTLY)
// =========================================================
export const reminderIdValidator = [rules.id];

export const createReminderValidator = [
  rules.title,
  
  // Date Logic (Applied to whole body to catch reminderDate/Time fields)
  body().custom((_, meta) => validateReminderDateTime(null, meta)),
  
  rules.type,
  rules.priority,
  rules.assignee, // Enforce isolation on creation
];

export const updateReminderValidator = [
  rules.id,
  body("title").optional().trim().notEmpty(),
  
  // Only validate date if provided in update
  body("date")
    .optional()
    .custom((value, meta) => validateReminderDateTime(value, meta)),
    
  rules.type,
  rules.priority,
  rules.assignee, // Enforce isolation on update/reassign
];

export const snoozeReminderValidator = [
  rules.id,
  body("minutes")
    .isInt({ min: 5, max: 1440 })
    .withMessage("Snooze minutes must be between 5 and 1440"),
];