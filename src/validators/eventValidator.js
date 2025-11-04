import { body, param, query } from "express-validator";

export const createEventValidator = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Event title is required")
    .isLength({ max: 200 })
    .withMessage("Title cannot exceed 200 characters"),

  body("type")
    .notEmpty()
    .withMessage("Event type is required")
    .isIn(["wedding", "birthday", "corporate", "conference", "party", "other"])
    .withMessage("Invalid event type"),

  body("clientId")
    .notEmpty()
    .withMessage("Client is required")
    .isMongoId()
    .withMessage("Invalid client ID"),

  body("startDate")
    .notEmpty()
    .withMessage("Start date is required")
    .isISO8601()
    .withMessage("Invalid start date format"),

  body("endDate")
    .notEmpty()
    .withMessage("End date is required")
    .isISO8601()
    .withMessage("Invalid end date format")
    .custom((value, { req }) => {
      if (new Date(value) <= new Date(req.body.startDate)) {
        throw new Error("End date must be after start date");
      }
      return true;
    }),

  body("guestCount")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Guest count must be at least 1"),

  body("pricing.basePrice")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Base price cannot be negative"),

  body("pricing.discount")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Discount cannot be negative"),
];

export const updateEventValidator = [
  param("id")
    .isMongoId()
    .withMessage("Invalid event ID"),

  body("title")
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Title cannot exceed 200 characters"),

  body("type")
    .optional()
    .isIn(["wedding", "birthday", "corporate", "conference", "party", "other"])
    .withMessage("Invalid event type"),

  body("startDate")
    .optional()
    .isISO8601()
    .withMessage("Invalid start date format"),

  body("endDate")
    .optional()
    .isISO8601()
    .withMessage("Invalid end date format"),

  body("status")
    .optional()
    .isIn(["pending", "confirmed", "in-progress", "completed", "cancelled"])
    .withMessage("Invalid status"),
];

export const getEventValidator = [
  param("id")
    .isMongoId()
    .withMessage("Invalid event ID"),
];

export const listEventsValidator = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),

  query("status")
    .optional()
    .isIn(["pending", "confirmed", "in-progress", "completed", "cancelled"])
    .withMessage("Invalid status"),

  query("type")
    .optional()
    .isIn(["wedding", "birthday", "corporate", "conference", "party", "other"])
    .withMessage("Invalid event type"),

  query("startDate")
    .optional()
    .isISO8601()
    .withMessage("Invalid start date format"),

  query("endDate")
    .optional()
    .isISO8601()
    .withMessage("Invalid end date format"),
];