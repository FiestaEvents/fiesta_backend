import { body, param } from "express-validator";
import { SupplyCategory } from "../models/index.js";

// =========================================================
// REUSABLE RULES 
// =========================================================
const commonRules = {
  // --- Primitive Fields ---
  name: body("name")
    .trim()
    .notEmpty().withMessage("Item name is required")
    .isLength({ min: 2, max: 100 }).withMessage("Name must be between 2 and 100 characters"),

  // ✅ TENANT ISOLATION: Ensure category belongs to Business
  categoryId: body("categoryId")
    .notEmpty().withMessage("Category is required")
    .isMongoId().withMessage("Invalid category ID")
    .custom(async (val, { req }) => {
      const category = await SupplyCategory.findOne({ 
        _id: val, 
        businessId: req.user.businessId 
      });
      if (!category) {
        throw new Error("Category not found or does not belong to your business");
      }
      return true;
    }),

  // ✅ CHANGED: isFloat to support Catering (kg/liters) and Florists (meters)
  currentStock: body("currentStock")
    .notEmpty().withMessage("Current stock is required")
    .isFloat({ min: 0 }).withMessage("Current stock must be a non-negative number"),

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

  // --- Nested Fields ---
  "supplier.name": body("supplier.name")
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage("Supplier name too long"),

  "supplier.phone": body("supplier.phone")
    .optional({ checkFalsy: true }) 
    .trim()
    .isMobilePhone("any").withMessage("Invalid supplier phone"),

  "supplier.email": body("supplier.email")
    .optional({ checkFalsy: true }) 
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
// =========================================================
export const createSupplyValidator = [
  commonRules.name,
  commonRules.categoryId,
  commonRules.unit,
  commonRules.currentStock,
  commonRules.costPerUnit,

  body("minimumStock").optional().isFloat({ min: 0 }),
  body("maximumStock").optional().isFloat({ min: 0 }),
  
  // businessId is set by server, but validate if sent manually (formerly venueId)
  body("businessId").optional().isMongoId().withMessage("Invalid Business ID"),

  body("pricingType")
    .optional()
    .isIn(["included", "chargeable", "optional"])
    .withMessage("Invalid pricing type"),

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
// =========================================================
export const updateSupplyValidator = [
  param("id").isMongoId().withMessage("Invalid supply ID"),

  // Re-verify category ownership if changing category
  body("categoryId")
    .optional()
    .isMongoId()
    .withMessage("Invalid category ID")
    .custom(async (val, { req }) => {
      const category = await SupplyCategory.findOne({ 
        _id: val, 
        businessId: req.user.businessId 
      });
      if (!category) throw new Error("Category does not belong to your business");
      return true;
    }),

  body("name").optional().trim().isLength({ min: 2, max: 100 }),
  body("currentStock").optional().isFloat({ min: 0 }),
  body("minimumStock").optional().isFloat({ min: 0 }),
  body("maximumStock").optional().isFloat({ min: 0 }),
  body("unit").optional().trim().isLength({ max: 20 }),
  body("costPerUnit").optional().isFloat({ min: 0 }),
  
  body("pricingType").optional().isIn(["included", "chargeable", "optional"]),
  body("chargePerUnit").optional().isFloat({ min: 0 }),
  
  body("status").optional().isIn(["active", "inactive", "discontinued", "out_of_stock"]),

  // Nested validators
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
    .isFloat({ min: 0.01 }).withMessage("Quantity must be a positive number"), // Changed to isFloat

  body("type")
    .notEmpty().withMessage("Type is required")
    .isIn(["purchase", "usage", "adjustment", "return", "waste"]).withMessage("Invalid type"),

  body("reference").optional().trim().isLength({ max: 200 }),
  body("notes").optional().trim().isLength({ max: 200 }),
];