import { body, param, query } from "express-validator";
import { Client } from "../models/index.js";

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
    .isIn(["wedding", "birthday", "corporate", "conference", "party", "concert", "shoot", "delivery", "other"])
    .withMessage("Invalid event type"),

  // ✅ TENANT ISOLATION: Ensure Client belongs to the Business
  body("clientId")
    .notEmpty()
    .withMessage("Client is required")
    .isMongoId()
    .withMessage("Invalid client ID")
    .custom(async (val, { req }) => {
      const client = await Client.findOne({ 
        _id: val, 
        businessId: req.user.businessId 
      });
      if (!client) {
        throw new Error("Client not found or does not belong to your business");
      }
      return true;
    }),

  body("startDate")
    .notEmpty()
    .withMessage("Start date is required")
    .isISO8601()
    .withMessage("Invalid start date format")
    .toDate(),

  body("endDate")
    .custom((value, { req }) => {
      // Logic for same-day events (e.g. a 2-hour photoshoot)
      if (req.body.sameDayEvent === true || req.body.sameDayEvent === "true") {
        return true; 
      }

      if (!value) {
        throw new Error("End date is required");
      }

      const endDateValid = /^\d{4}-\d{2}-\d{2}/.test(value) || !Number.isNaN(Date.parse(value));
      if (!endDateValid) {
        throw new Error("Invalid end date format");
      }

      const start = new Date(req.body.startDate);
      const end = new Date(value);

      if (end < start) {
        throw new Error("End date must be after start date");
      }
      
      // Time validation if provided
      if (req.body.startTime && req.body.endTime && start.getTime() === end.getTime()) {
         if (req.body.startTime >= req.body.endTime) {
            throw new Error("End time must be after start time for same-day events");
         }
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
  param("id").isMongoId().withMessage("Invalid event ID"),

  body("title")
    .optional()
    .trim()
    .isLength({ max: 200 }),

  body("clientId")
    .optional()
    .isMongoId()
    .custom(async (val, { req }) => {
      const client = await Client.findOne({ 
        _id: val, 
        businessId: req.user.businessId 
      });
      if (!client) throw new Error("Client does not belong to your business");
      return true;
    }),

  body("type")
    .optional()
    .isIn(["wedding", "birthday", "corporate", "conference", "party", "concert", "shoot", "delivery", "other"]),

  body("startDate").optional().isISO8601().toDate(),
  body("endDate").optional().isISO8601().toDate(),

  body("status")
    .optional()
    .isIn(["pending", "confirmed", "in-progress", "completed", "cancelled"]),
];

export const getEventValidator = [
  param("id").isMongoId().withMessage("Invalid event ID"),
];

export const listEventsValidator = [
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
  query("status").optional().isIn(["pending", "confirmed", "in-progress", "completed", "cancelled"]),
  query("type").optional().trim(),
  query("clientId").optional().isMongoId(),
  query("startDate").optional().isISO8601(),
  query("endDate").optional().isISO8601(),
];