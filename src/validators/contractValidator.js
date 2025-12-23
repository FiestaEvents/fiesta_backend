import { body, param, query } from "express-validator";

// =========================================================
// REUSABLE RULES
// =========================================================
const commonRules = {
  mongoId: (field) => 
    body(field)
      .optional({ checkFalsy: true }) // Allow empty strings or null
      .isMongoId().withMessage(`Invalid ${field} format`),

  title: body("title")
    .trim()
    .notEmpty().withMessage("Contract title is required")
    .isLength({ max: 100 }).withMessage("Title too long"),

  status: body("status")
    .optional()
    .isIn(["draft", "sent", "viewed", "signed", "cancelled", "expired"]),

  // Party Validation (Nested Object)
  partyName: body("party.name").notEmpty().withMessage("Party Name is required"),
  partyType: body("party.type").isIn(["individual", "company"]).withMessage("Invalid Party Type"),
  partyAddress: body("party.address").notEmpty().withMessage("Address is required"),
  
  // Logistics Validation
  startDate: body("logistics.startDate").isISO8601().toDate().withMessage("Invalid Start Date"),
  endDate: body("logistics.endDate").isISO8601().toDate().withMessage("Invalid End Date"),
};

// =========================================================
// CREATE CONTRACT VALIDATOR
// =========================================================
export const createContractValidator = [
  commonRules.title,
  commonRules.status,
  
  // Optional Links
  commonRules.mongoId("eventId"), 
  
  // Party Details
  commonRules.partyName,
  commonRules.partyType,
  commonRules.partyAddress,
  
  // Logistics
  commonRules.startDate,
  commonRules.endDate,

  // Services Array (renamed from items to services)
  body("services")
    .isArray({ min: 1 }).withMessage("At least one service is required"),
  
  body("services.*.description")
    .notEmpty().withMessage("Service description is required"),
  
  body("services.*.quantity")
    .isFloat({ min: 0.01 }).withMessage("Quantity must be positive"),
  
  body("services.*.rate")
    .isFloat({ min: 0 }).withMessage("Rate must be non-negative"),

  // Financials (Nested Object)
  body("financials.amountHT").isFloat({ min: 0 }),
  body("financials.totalTTC").isFloat({ min: 0 }),
  body("financials.vatRate").optional().isFloat({ min: 0, max: 100 }),
];

// =========================================================
// UPDATE CONTRACT VALIDATOR
// =========================================================
export const updateContractValidator = [
  param("id").isMongoId().withMessage("Invalid contract ID"),
  
  body("title").optional().trim().notEmpty(),
  
  // Optional deep updates
  body("party.name").optional().notEmpty(),
  body("services").optional().isArray(),
  body("financials").optional().isObject(),
];

// ... (Rest of file: ID Validator, Settings Validator) ...
export const contractIdValidator = [
  param("id").isMongoId().withMessage("Invalid contract ID"),
];

export const contractSettingsValidator = [
  body("companyInfo.name").optional().trim().notEmpty(),
  body("financialDefaults.defaultVatRate").optional().isFloat({ min: 0, max: 100 }),
];