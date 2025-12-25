import { body, param } from "express-validator";
import { Role, Permission } from "../models/index.js";

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
    .custom(async (ids) => {
      // 1. Validate format
      if (!ids.every(id => typeof id === 'string' && id.match(/^[0-9a-fA-F]{24}$/))) {
        throw new Error("One or more permission IDs are invalid");
      }
      
      // 2. Validate existence in DB
      const count = await Permission.countDocuments({ _id: { $in: ids } });
      if (count !== ids.length) {
        throw new Error("One or more permissions do not exist");
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
  commonRules.name
    .custom(async (value, { req }) => {
      // ✅ TENANT ISOLATION: Check for duplicates within this Business
      const exists = await Role.findOne({
        name: { $regex: new RegExp(`^${value}$`, "i") }, // Case insensitive
        businessId: req.user.businessId,
        isArchived: false
      });
      if (exists) {
        throw new Error("A role with this name already exists in your business");
      }
      return true;
    }),

  commonRules.description,
  
  // Permissions are required on creation
  body("permissionIds")
    .isArray({ min: 1 }).withMessage("At least one permission is required")
    .custom(async (ids) => {
      const count = await Permission.countDocuments({ _id: { $in: ids } });
      if (count !== ids.length) {
        throw new Error("One or more permissions do not exist");
      }
      return true;
    }),
];

// =========================================================
// UPDATE VALIDATOR
// =========================================================
export const updateRoleValidator = [
  param("id").isMongoId().withMessage("Invalid role ID"),
  
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .matches(/^[a-zA-Z0-9\s-_]+$/)
    .custom(async (value, { req }) => {
      // ✅ TENANT ISOLATION: Check for duplicates (excluding self)
      const exists = await Role.findOne({
        name: { $regex: new RegExp(`^${value}$`, "i") },
        businessId: req.user.businessId,
        _id: { $ne: req.params.id }, // Exclude current role
        isArchived: false
      });
      if (exists) {
        throw new Error("A role with this name already exists");
      }
      return true;
    }),

  commonRules.description,
  commonRules.permissionIds,
];