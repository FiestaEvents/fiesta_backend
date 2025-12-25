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

  contractType: body("contractType")
    .optional()
    .isIn(["client", "partner", "employment"])
    .withMessage("Invalid contract type"),

  status: body("status")
    .optional()
    .isIn(["draft", "sent", "viewed", "signed", "cancelled", "expired", "active"]),

  // Party Validation (The entity being contracted: Client or Partner)
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
  commonRules.contractType,
  commonRules.status,
  
  // Optional Links
  commonRules.mongoId("eventId"), 
  commonRules.mongoId("clientId"), // Link to CRM
  
  // Party Details (Snapshot of the client/partner at time of creation)
  commonRules.partyName,
  commonRules.partyType,
  commonRules.partyAddress,
  
  // Logistics
  commonRules.startDate,
  commonRules.endDate,

  // Services Array (Renamed from items to services for semantic clarity)
  body("services")
    .isArray({ min: 1 }).withMessage("At least one service/item is required"),
  
  body("services.*.description")
    .trim()
    .notEmpty().withMessage("Service description is required"),
  
  body("services.*.quantity")
    .isFloat({ min: 0 }).withMessage("Quantity must be positive"),
  
  body("services.*.rate")
    .isFloat({ min: 0 }).withMessage("Rate must be non-negative"),
  
  body("services.*.amount")
    .isFloat({ min: 0 }).withMessage("Line amount must be non-negative"),

  // Financials (Nested Object)
  body("financials.amountHT").isFloat({ min: 0 }).withMessage("Total HT must be valid"),
  body("financials.totalTTC").isFloat({ min: 0 }).withMessage("Total TTC must be valid"),
  body("financials.vatRate").optional().isFloat({ min: 0, max: 100 }),
  body("financials.stampDuty").optional().isFloat({ min: 0 }),
];

// =========================================================
// UPDATE CONTRACT VALIDATOR
// =========================================================
export const updateContractValidator = [
  param("id").isMongoId().withMessage("Invalid contract ID"),
  
  body("title").optional().trim().notEmpty(),
  body("status").optional().isIn(["draft", "sent", "viewed", "signed", "cancelled", "expired", "active"]),
  
  // Optional deep updates
  body("party.name").optional().notEmpty(),
  body("services").optional().isArray(),
  body("financials").optional().isObject(),
];

// =========================================================
// QUERY VALIDATORS
// =========================================================

export const getContractsValidator = [
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  query("search").optional().trim(),
  query("contractType").optional().isIn(["client", "partner", "employment"]),
  query("status").optional().trim(),
  query("eventId").optional().isMongoId(),
];

// =========================================================
// ID & SETTINGS VALIDATORS
// =========================================================

export const contractIdValidator = [
  param("id").isMongoId().withMessage("Invalid contract ID"),
];

export const contractSettingsValidator = [
  body("branding.colors.primary").optional().isHexColor().withMessage("Invalid primary color"),
  body("companyInfo.displayName").optional().trim().notEmpty(),
  body("financialDefaults.currency").optional().isLength({ max: 3 }),
  body("financialDefaults.defaultVatRate").optional().isFloat({ min: 0, max: 100 }),
  body("labels.contractTitle").optional().trim(),
];