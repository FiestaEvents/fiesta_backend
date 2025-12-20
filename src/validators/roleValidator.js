import { body, param } from "express-validator";

// =========================================================
// REUSABLE RULES
// =========================================================
const commonRules = {
  name: body("name")
    .trim()
    .notEmpty().withMessage("Role name is required")
    .isLength({ min: 2, max: 50 }).withMessage("Role name must be between 2 and 50 characters")
    .matches(/^[a-zA-Z0-9\s-_]+$/).withMessage("Role name contains invalid characters"),

  description: body("description")
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage("Description cannot exceed 200 characters"),

  permissionIds: body("permissionIds")
    .optional()
    .isArray().withMessage("Permissions must be provided as an array")
    .custom((ids) => {
      // Validate that every item in the array is a MongoID
      if (!ids.every(id => typeof id === 'string' && id.match(/^[0-9a-fA-F]{24}$/))) {
        throw new Error("One or more permission IDs are invalid");
      }
      return true;
    }),
};

// =========================================================
// ID VALIDATOR
// =========================================================
export const roleIdValidator = [
  param("id").isMongoId().withMessage("Invalid role ID"),
];

// =========================================================
// CREATE VALIDATOR
// =========================================================
export const createRoleValidator = [
  commonRules.name,
  commonRules.description,
  
  // Permissions are required on creation (usually)
  body("permissionIds")
    .isArray({ min: 1 }).withMessage("At least one permission is required")
    .custom((ids) => {
      if (!ids.every(id => typeof id === 'string' && id.match(/^[0-9a-fA-F]{24}$/))) {
        throw new Error("One or more permission IDs are invalid");
      }
      return true;
    }),
];

// =========================================================
// UPDATE VALIDATOR
// =========================================================
export const updateRoleValidator = [
  param("id").isMongoId().withMessage("Invalid role ID"),
  body("name").optional().trim().isLength({ min: 2 }),
  body("description").optional().trim(),
  body("permissionIds").optional().isArray().withMessage("Permissions must be an array"),
];