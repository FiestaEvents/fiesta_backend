import { body, param, query } from "express-validator";

// =========================================================
// REUSABLE RULES
// =========================================================
const commonRules = {
  mongoId: (field) => 
    body(field)
      .notEmpty().withMessage(`${field} is required`)
      .isMongoId().withMessage(`Invalid ${field} format`),
  
  optionalMongoId: (field) =>
    body(field)
      .optional()
      .isMongoId().withMessage(`Invalid ${field} format`),

  title: body("title")
    .trim()
    .notEmpty().withMessage("Contract title is required")
    .isLength({ max: 100 }).withMessage("Title must be less than 100 characters"),

  status: body("status")
    .optional()
    .isIn(["draft", "sent", "viewed", "signed", "cancelled", "expired"])
    .withMessage("Invalid status value"),

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
export const contractIdValidator = [
  param("id")
    .isMongoId().withMessage("Invalid contract ID"),
];

// =========================================================
// CREATE CONTRACT VALIDATOR
// =========================================================
export const createContractValidator = [
  commonRules.mongoId("clientId"),
  commonRules.mongoId("eventId"), // Link to event
  
  commonRules.title,
  
  commonRules.status,
  
  commonRules.date("validUntil"),
  
  // Terms & Notes
  body("terms")
    .optional()
    .trim()
    .isLength({ max: 5000 }).withMessage("Terms cannot exceed 5000 characters"),
  
  body("notes")
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage("Notes cannot exceed 1000 characters"),

  // Items Array Validation
  body("items")
    .isArray({ min: 1 }).withMessage("Contract must have at least one item"),
  
  body("items.*.description")
    .notEmpty().withMessage("Item description is required"),
  
  body("items.*.quantity")
    .isFloat({ min: 0.01 }).withMessage("Quantity must be greater than 0"),
  
  body("items.*.unitPrice")
    .isFloat({ min: 0 }).withMessage("Unit price must be positive"),
  
  body("items.*.taxRate")
    .optional()
    .isFloat({ min: 0, max: 100 }).withMessage("Tax rate must be between 0 and 100"),

  // Financials
  commonRules.money("taxAmount"),
  commonRules.money("discountAmount"),
  commonRules.money("totalAmount"),
];

// =========================================================
// UPDATE CONTRACT VALIDATOR
// =========================================================
export const updateContractValidator = [
  param("id").isMongoId().withMessage("Invalid contract ID"),

  commonRules.optionalMongoId("clientId"),
  commonRules.optionalMongoId("eventId"),
  
  body("title")
    .optional()
    .trim()
    .notEmpty().withMessage("Title cannot be empty"),

  commonRules.status,
  commonRules.date("validUntil"),

  body("items")
    .optional()
    .isArray().withMessage("Items must be an array"),
  
  body("items.*.description")
    .optional()
    .notEmpty().withMessage("Item description cannot be empty"),
    
  body("items.*.quantity")
    .optional()
    .isFloat({ min: 0.01 }),

  body("items.*.unitPrice")
    .optional()
    .isFloat({ min: 0 }),
];

// =========================================================
// SETTINGS VALIDATOR
// =========================================================
export const contractSettingsValidator = [
  body("prefix")
    .optional()
    .trim()
    .notEmpty().withMessage("Prefix cannot be empty")
    .isLength({ max: 10 }).withMessage("Prefix too long"),

  body("nextNumber")
    .optional()
    .isInt({ min: 1 }).withMessage("Next number must be a positive integer"),

  body("defaultTerms")
    .optional()
    .trim(),

  body("defaultTaxRate")
    .optional()
    .isFloat({ min: 0, max: 100 }).withMessage("Default tax rate must be between 0 and 100"),

  body("currency")
    .optional()
    .trim()
    .isLength({ min: 3, max: 3 }).withMessage("Currency must be a 3-letter ISO code (e.g., USD)"),
];

// =========================================================
// SEARCH/FILTER VALIDATOR
// =========================================================
export const contractQueryValidator = [
  query("status")
    .optional()
    .isIn(["draft", "sent", "viewed", "signed", "cancelled", "expired"]),
  
  query("clientId").optional().isMongoId(),
  query("eventId").optional().isMongoId(),
  
  query("startDate").optional().isISO8601().toDate(),
  query("endDate").optional().isISO8601().toDate(),
];