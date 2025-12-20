import { body, param } from "express-validator";

// =========================================================
// REUSABLE RULES
// =========================================================
const commonRules = {
  name: body("name")
    .trim()
    .notEmpty().withMessage("Partner name is required")
    .isLength({ min: 2, max: 100 }).withMessage("Name must be between 2 and 100 characters"),

  email: body("email")
    .optional() // Partners might not always have an email in the system
    .trim()
    .isEmail().withMessage("Invalid email address")
    .normalizeEmail(),

  phone: body("phone")
    .optional()
    .trim()
    .isMobilePhone("any").withMessage("Invalid phone number"),

  category: body("category")
    .trim()
    .notEmpty().withMessage("Category is required (e.g., Catering, Photography)"),
    
  status: body("status")
    .optional()
    .isIn(["active", "inactive", "blacklisted"])
    .withMessage("Invalid status"),
};

// =========================================================
// ID VALIDATOR
// =========================================================
export const partnerIdValidator = [
  param("id").isMongoId().withMessage("Invalid partner ID"),
];

// =========================================================
// CREATE VALIDATOR
// =========================================================
export const createPartnerValidator = [
  commonRules.name,
  commonRules.category,
  commonRules.email,
  commonRules.phone,
  commonRules.status,
  
  body("services")
    .optional()
    .isArray().withMessage("Services must be an array of strings"),
    
  body("commissionRate")
    .optional()
    .isFloat({ min: 0, max: 100 }).withMessage("Commission rate must be between 0 and 100"),
];

// =========================================================
// UPDATE VALIDATOR
// =========================================================
export const updatePartnerValidator = [
  param("id").isMongoId().withMessage("Invalid partner ID"),
  
  body("name").optional().trim().isLength({ min: 2 }),
  body("category").optional().trim().notEmpty(),
  commonRules.email,
  commonRules.phone,
  commonRules.status,
  
  body("notes").optional().trim().isLength({ max: 1000 }),
];