import { body, param } from "express-validator";
import { Client, Event } from "../models/index.js";

// =========================================================
// REUSABLE RULES
// =========================================================
const commonRules = {
  date: (field) => 
    body(field)
      .optional()
      .isISO8601().withMessage(`Invalid date format for ${field}`)
      .toDate(),

  money: (field) =>
    body(field)
      .optional()
      .isFloat({ min: 0 }).withMessage(`${field} must be a positive number`),
};

// =========================================================
// ID VALIDATORS
// =========================================================
export const invoiceIdValidator = [
  param("id").isMongoId().withMessage("Invalid invoice ID"),
];

// =========================================================
// CREATE INVOICE VALIDATOR
// =========================================================
export const createInvoiceValidator = [
  // Tenant Isolation: Verify Client belongs to Business
  body("client")
    .notEmpty().withMessage("Client is required")
    .isMongoId().withMessage("Invalid Client ID")
    .custom(async (val, { req }) => {
      const client = await Client.findOne({ 
        _id: val, 
        businessId: req.user.businessId 
      });
      if (!client) throw new Error("Client not found or does not belong to your business");
      return true;
    }),
  
  // Tenant Isolation: Verify Event (if provided) belongs to Business
  body("event")
    .optional({ checkFalsy: true })
    .isMongoId().withMessage("Invalid Event ID")
    .custom(async (val, { req }) => {
      if (!val) return true;
      const event = await Event.findOne({ 
        _id: val, 
        businessId: req.user.businessId 
      });
      if (!event) throw new Error("Event not found or does not belong to your business");
      return true;
    }),

  commonRules.date("issueDate"),
  commonRules.date("dueDate"),

  body("currency")
    .optional()
    .isLength({ min: 3, max: 3 }).withMessage("Currency must be a 3-letter ISO code"),

  body("items")
    .isArray({ min: 1 }).withMessage("Invoice must have at least one item"),

  body("items.*.description")
    .notEmpty().withMessage("Item description is required"),

  body("items.*.quantity")
    .isFloat({ min: 0.01 }).withMessage("Quantity must be greater than 0"),

  body("items.*.rate")
    .isFloat({ min: 0 }).withMessage("Unit price must be positive"),

  // Financials
  commonRules.money("taxRate"),
  commonRules.money("discount"),
];

// =========================================================
// UPDATE INVOICE VALIDATOR
// =========================================================
export const updateInvoiceValidator = [
  param("id").isMongoId().withMessage("Invalid invoice ID"),
  
  // If updating client, re-verify ownership
  body("client")
    .optional()
    .isMongoId()
    .custom(async (val, { req }) => {
      const client = await Client.findOne({ 
        _id: val, 
        businessId: req.user.businessId 
      });
      if (!client) throw new Error("Client not found or does not belong to your business");
      return true;
    }),
  
  body("status")
    .optional()
    .isIn(["draft", "sent", "viewed", "paid", "overdue", "cancelled", "refunded"])
    .withMessage("Invalid status"),

  body("items")
    .optional()
    .isArray().withMessage("Items must be an array"),
    
  body("items.*.quantity")
    .optional()
    .isFloat({ min: 0.01 }).withMessage("Quantity must be positive"),

  body("items.*.rate")
    .optional()
    .isFloat({ min: 0 }).withMessage("Rate must be positive"),
];

// =========================================================
// SETTINGS VALIDATOR
// =========================================================
export const invoiceSettingsValidator = [
  body("prefix")
    .optional()
    .trim()
    .isLength({ max: 10 }).withMessage("Prefix too long"),

  body("nextNumber")
    .optional()
    .isInt({ min: 1 }).withMessage("Next number must be a positive integer"),

  body("defaultTaxRate")
    .optional()
    .isFloat({ min: 0, max: 100 }),

  body("defaultDueDays")
    .optional()
    .isInt({ min: 0 }).withMessage("Default due days must be a positive integer"),
    
  body("footerText")
    .optional()
    .trim()
    .isLength({ max: 500 }),
];