import { body, param } from "express-validator";

// =========================================================
// REUSABLE RULES 
// =========================================================
const commonRules = {
  // --- Primitive Fields ---
  name: body("name")
    .trim()
    .notEmpty().withMessage("Item name is required")
    .isLength({ min: 2, max: 100 }).withMessage("Name must be between 2 and 100 characters"),

  categoryId: body("categoryId")
    .notEmpty().withMessage("Category is required")
    .isMongoId().withMessage("Invalid category ID"),

  currentStock: body("currentStock")
    .notEmpty().withMessage("Current stock is required")
    .isInt({ min: 0 }).withMessage("Current stock must be a non-negative integer"),

  unit: body("unit")
    .trim()
    .notEmpty().withMessage("Unit of measurement is required")
    .isLength({ max: 20 }).withMessage("Unit cannot exceed 20 characters"),

  costPerUnit: body("costPerUnit")
    .notEmpty().withMessage("Cost per unit is required")
    .isFloat({ min: 0 }).withMessage("Cost must be a non-negative number"),

  // --- Object Structure Checks ---
  supplier: body("supplier")
    .optional()
    .isObject().withMessage("Supplier must be an object"),

  storage: body("storage")
    .optional()
    .isObject().withMessage("Storage info must be an object"),

  // --- Nested Fields (Defined as optional here for reuse) ---
  "supplier.name": body("supplier.name")
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage("Supplier name too long"),

  // ✅ FIX: Added { checkFalsy: true } to allow empty strings
  "supplier.phone": body("supplier.phone")
    .optional({ checkFalsy: true }) 
    .trim()
    .isMobilePhone("any").withMessage("Invalid supplier phone"),

  "supplier.email": body("supplier.email")
    .optional({ checkFalsy: true }) // Allows empty string or null
    .trim()
    .isEmail().withMessage("Invalid supplier email"),

  "storage.location": body("storage.location")
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage("Storage location too long"),

  "storage.requiresRefrigeration": body("storage.requiresRefrigeration")
    .optional()
    .isBoolean().withMessage("Must be a boolean"),

  "storage.expiryTracking": body("storage.expiryTracking")
    .optional()
    .isBoolean().withMessage("Must be a boolean"),
};

// =========================================================
// ID VALIDATOR
// =========================================================
export const supplyIdValidator = [
  param("id").isMongoId().withMessage("Invalid supply ID"),
];

// =========================================================
// CREATE VALIDATOR
// Strict requirements for creation
// =========================================================
export const createSupplyValidator = [
  commonRules.name,
  commonRules.categoryId,
  commonRules.unit,
  commonRules.currentStock,
  commonRules.costPerUnit,

  body("minimumStock").optional().isInt({ min: 0 }),
  body("maximumStock").optional().isInt({ min: 0 }),
  
  // venueId is set by server, but validate if sent manually
  body("venueId").optional().isMongoId().withMessage("Invalid venue ID"),

  body("pricingType").optional().isIn(["included", "chargeable", "optional"]).withMessage("Invalid pricing type"),

  // Conditional Validation for Create
  body("chargePerUnit")
    .if(body("pricingType").equals("chargeable"))
    .notEmpty().withMessage("Charge per unit is required for chargeable items")
    .isFloat({ min: 0 }).withMessage("Charge per unit must be non-negative"),

  // Include Nested Validators
  commonRules.supplier,
  commonRules["supplier.name"],
  commonRules["supplier.phone"],
  commonRules["supplier.email"],
  
  commonRules.storage,
  commonRules["storage.location"],
  commonRules["storage.requiresRefrigeration"],
  commonRules["storage.expiryTracking"],
  
  body("notes").optional().trim().isString(),
];

// =========================================================
// UPDATE VALIDATOR (PUT & PATCH)
// Everything is optional here to support partial updates
// =========================================================
export const updateSupplyValidator = [
  param("id").isMongoId().withMessage("Invalid supply ID"),

  // Top-level fields (Redefined as optional for PATCH compatibility)
  body("name").optional().trim().isLength({ min: 2, max: 100 }).withMessage("Name invalid"),
  body("categoryId").optional().isMongoId().withMessage("Invalid category ID"),
  body("currentStock").optional().isInt({ min: 0 }).withMessage("Invalid stock"),
  body("minimumStock").optional().isInt({ min: 0 }).withMessage("Invalid min stock"),
  body("maximumStock").optional().isInt({ min: 0 }).withMessage("Invalid max stock"),
  body("unit").optional().trim().isLength({ max: 20 }),
  body("costPerUnit").optional().isFloat({ min: 0 }),
  
  body("pricingType").optional().isIn(["included", "chargeable", "optional"]),
  body("chargePerUnit").optional().isFloat({ min: 0 }),
  
  body("status").optional().isIn(["active", "inactive", "discontinued", "out_of_stock"]),

  // ✅ FIX: Include nested validators to ensure they are checked (and allowed to be empty)
  commonRules.supplier,
  commonRules["supplier.name"],
  commonRules["supplier.phone"],
  commonRules["supplier.email"],

  commonRules.storage,
  commonRules["storage.location"],
  commonRules["storage.requiresRefrigeration"],
  commonRules["storage.expiryTracking"],

  body("notes").optional().trim(),
];

// =========================================================
// STOCK UPDATE VALIDATOR
// =========================================================
export const updateStockValidator = [
  param("id").isMongoId().withMessage("Invalid supply ID"),

  body("quantity")
    .notEmpty().withMessage("Quantity is required")
    .isInt({ min: 1 }).withMessage("Quantity must be a positive integer"),

  body("type")
    .notEmpty().withMessage("Type is required")
    .isIn(["purchase", "usage", "adjustment", "return", "waste"]).withMessage("Invalid type"),

  body("reference").optional().trim().isLength({ max: 200 }),
  body("notes").optional().trim().isLength({ max: 200 }),
];