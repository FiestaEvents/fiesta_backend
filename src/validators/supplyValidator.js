import { body, param } from "express-validator";

// =========================================================
// REUSABLE RULES (match model field names and only require model-required fields)
// =========================================================
const commonRules = {
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

  minimumStock: body("minimumStock")
    .optional()
    .isInt({ min: 0 }).withMessage("Minimum stock must be a non-negative integer"),

  unit: body("unit")
    .trim()
    .notEmpty().withMessage("Unit of measurement is required")
    .isLength({ max: 20 }).withMessage("Unit cannot exceed 20 characters"),

  costPerUnit: body("costPerUnit")
    .notEmpty().withMessage("Cost per unit is required")
    .isFloat({ min: 0 }).withMessage("Cost must be a non-negative number"),

  supplier: body("supplier")
    .optional()
    .isObject().withMessage("Supplier must be an object"),

  "supplier.name": body("supplier.name")
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage("Supplier name too long"),

  "supplier.phone": body("supplier.phone")
    .optional()
    .trim()
    .isMobilePhone("any").withMessage("Invalid supplier phone"),

  storage: body("storage")
    .optional()
    .isObject().withMessage("Storage info must be an object"),

  "storage.location": body("storage.location")
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage("Storage location too long"),

  "storage.requiresRefrigeration": body("storage.requiresRefrigeration")
    .optional()
    .isBoolean(),

  "storage.expiryTracking": body("storage.expiryTracking")
    .optional()
    .isBoolean(),
};

// =========================================================
// ID VALIDATOR
// =========================================================
export const supplyIdValidator = [
  param("id").isMongoId().withMessage("Invalid supply ID"),
];

// =========================================================
// CREATE VALIDATOR
// Only require fields that the model marks as required
// =========================================================
export const createSupplyValidator = [
  commonRules.name,
  commonRules.categoryId,
  commonRules.unit,
  commonRules.currentStock,
  commonRules.costPerUnit,

  // venueId is set by server from authenticated user; validate only when provided
  body("venueId").optional().isMongoId().withMessage("Invalid venue ID"),

  // pricingType values must match the model
  body("pricingType").optional().isIn(["included", "chargeable", "optional"]).withMessage("Invalid pricing type"),

  // If chargeable, require a positive chargePerUnit
  body("chargePerUnit")
    .if(body("pricingType").equals("chargeable"))
    .notEmpty().withMessage("Charge per unit is required for chargeable pricing")
    .isFloat({ min: 0 }).withMessage("Charge per unit must be a non-negative number"),

  // Optional structured fields
  commonRules.supplier,
  commonRules.storage,
];

// =========================================================
// UPDATE VALIDATOR
// =========================================================
export const updateSupplyValidator = [
  param("id").isMongoId().withMessage("Invalid supply ID"),

  // Allow updating fields; validate when present
  body("name").optional().trim().isLength({ min: 2, max: 100 }).withMessage("Name must be between 2 and 100 characters"),
  body("categoryId").optional().isMongoId().withMessage("Invalid category ID"),
  body("currentStock").optional().isInt({ min: 0 }).withMessage("Current stock must be a non-negative integer"),
  body("minimumStock").optional().isInt({ min: 0 }).withMessage("Minimum stock must be a non-negative integer"),
  body("unit").optional().trim().isLength({ max: 20 }).withMessage("Unit cannot exceed 20 characters"),
  body("costPerUnit").optional().isFloat({ min: 0 }).withMessage("Cost must be a non-negative number"),

  body("pricingType").optional().isIn(["included", "chargeable", "optional"]).withMessage("Invalid pricing type"),
  body("chargePerUnit").optional().isFloat({ min: 0 }).withMessage("Charge per unit must be a non-negative number"),

  body("status").optional().isIn(["active", "inactive", "discontinued", "out_of_stock"]).withMessage("Invalid status"),

  commonRules.supplier,
  commonRules.storage,
];

// =========================================================
// STOCK UPDATE VALIDATOR
// Validate quantity and type to match controller expectations
// =========================================================
export const updateStockValidator = [
  param("id").isMongoId().withMessage("Invalid supply ID"),

  body("quantity")
    .notEmpty().withMessage("Quantity is required")
    .isInt({ min: 1 }).withMessage("Quantity must be a positive integer"),

  body("type")
    .notEmpty().withMessage("Type is required")
    .isIn(["purchase", "usage", "adjustment", "return", "waste"]).withMessage("Invalid stock type"),

  body("reference").optional().trim().isLength({ max: 200 }).withMessage("Reference too long"),
  body("notes").optional().trim().isLength({ max: 200 }).withMessage("Notes too long"),
];