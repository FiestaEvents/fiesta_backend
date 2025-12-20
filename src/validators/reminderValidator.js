import { body, param } from "express-validator";

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
    return new Date(y, m - 1, d, h, min, 0, 0); // LOCAL
  }

  return null;
};

const validateReminderDateTime = (value, { req }) => {
  const finalDate = buildLocalDateTime({
    date: value,
    reminderDate: req.body.reminderDate,
    reminderTime: req.body.reminderTime,
  });

  if (!finalDate) {
    throw new Error("Reminder date and time are required");
  }

  if (isNaN(finalDate.getTime())) {
    throw new Error("Invalid reminder date or time");
  }

  const now = new Date();
  const MIN_DELAY_MS = 60 * 1000; // 1 minute (change to 2 if you want)

  if (finalDate.getTime() < now.getTime() + MIN_DELAY_MS) {
    throw new Error("Reminder must be at least 1 minute from now");
  }

  // Normalize for controllers / Agenda
  req.body.reminderDateTime = finalDate;

  req.body.reminderDate ??= finalDate.toISOString().slice(0, 10);

  req.body.reminderTime ??= `${String(finalDate.getHours()).padStart(
    2,
    "0"
  )}:${String(finalDate.getMinutes()).padStart(2, "0")}`;

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
};

// =========================================================
// EXPORTED VALIDATORS (MATCH ROUTES EXACTLY)
// =========================================================
export const reminderIdValidator = [rules.id];

export const createReminderValidator = [
  rules.title,
  body().custom((_, meta) => validateReminderDateTime(null, meta)),
  rules.type,
  rules.priority,
  body("assignedTo").optional().isMongoId(),
];

export const updateReminderValidator = [
  rules.id,
  body("title").optional().trim().notEmpty(),
  body("date")
    .optional()
    .custom((value, meta) => validateReminderDateTime(value, meta)),
  rules.type,
  rules.priority,
];

export const snoozeReminderValidator = [
  rules.id,
  body("minutes")
    .isInt({ min: 5, max: 1440 })
    .withMessage("Snooze minutes must be between 5 and 1440"),
];
