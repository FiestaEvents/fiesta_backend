import { body, param, query } from "express-validator";
import { User, Role } from "../models/index.js";

// Common validation rules
const nameValidation = body("name")
  .optional()
  .trim()
  .notEmpty()
  .withMessage("Name cannot be empty")
  .isLength({ min: 2, max: 50 })
  .withMessage("Name must be between 2 and 50 characters")
  .matches(/^[a-zA-Z\s.'-]+$/)
  .withMessage("Name can only contain letters, spaces, apostrophes, hyphens, and periods");

const emailValidation = body("email")
  .trim()
  .notEmpty()
  .withMessage("Email is required")
  .isEmail()
  .withMessage("Please provide a valid email")
  .normalizeEmail()
  .isLength({ max: 100 })
  .withMessage("Email must be less than 100 characters");

const passwordValidation = body("password")
  .notEmpty()
  .withMessage("Password is required")
  .isLength({ min: 8 })
  .withMessage("Password must be at least 8 characters")
  .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
  .withMessage(
    "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
  )
  .isLength({ max: 128 })
  .withMessage("Password must be less than 128 characters");

const phoneValidation = body("phone")
  .optional()
  .trim()
  .isMobilePhone("any")
  .withMessage("Please provide a valid phone number")
  .isLength({ max: 20 })
  .withMessage("Phone number must be less than 20 characters");

// ✅ ROLE CHECK: Ensure Role belongs to Business
const roleIdValidation = body("roleId")
  .notEmpty().withMessage("Role ID is required")
  .isMongoId().withMessage("Invalid role ID format")
  .custom(async (val, { req }) => {
     if (!val) return true;
     const role = await Role.findOne({ _id: val, businessId: req.user.businessId });
     if (!role) throw new Error("Role not found or does not belong to your business");
     return true;
  });

const roleTypeValidation = body("roleType")
  .optional()
  .isIn(["owner", "manager", "staff", "viewer", "custom"])
  .withMessage("Role type must be one of: owner, manager, staff, viewer, custom");

const isActiveValidation = body("isActive")
  .optional()
  .isBoolean()
  .withMessage("isActive must be a boolean value");

// User Creation Validator
export const createUserValidator = [
  nameValidation,
  
  // ✅ EMAIL UNIQUE CHECK
  body("email")
    .trim()
    .notEmpty().withMessage("Email is required")
    .isEmail().withMessage("Invalid email")
    .normalizeEmail()
    .custom(async (val, { req }) => {
      const exists = await User.findOne({ email: val });
      if (exists) throw new Error("User with this email already exists");
      return true;
    }),
  
  passwordValidation,
  phoneValidation,
  roleIdValidation,
  roleTypeValidation,
  isActiveValidation,

  // Custom Permissions Logic
  body("customPermissions.granted")
    .optional()
    .isArray()
    .custom((value) => {
      if (value && value.length > 0) {
        return value.every(id => typeof id === 'string' && id.match(/^[0-9a-fA-F]{24}$/));
      }
      return true;
    })
    .withMessage("Granted permissions must contain valid permission IDs"),
];

// User Update Validator
export const updateUserValidator = [
  param("id").isMongoId().withMessage("Invalid user ID format"),

  nameValidation,

  body("email")
    .optional()
    .trim()
    .isEmail()
    .normalizeEmail(),

  phoneValidation,

  body("roleId")
    .optional()
    .isMongoId()
    .custom(async (val, { req }) => {
      if (!val) return true;
      const role = await Role.findOne({ _id: val, businessId: req.user.businessId });
      if (!role) throw new Error("Role not found in this business");
      return true;
    }),

  roleTypeValidation,
  isActiveValidation,

  body("customPermissions").optional().isObject(),
];

// User ID Parameter Validator
export const userIdValidator = [
  param("id").isMongoId().withMessage("Invalid user ID format"),
];

// Archive User Validator
export const archiveUserValidator = [
  param("id").isMongoId().withMessage("Invalid user ID format"),
  body("confirmation")
    .optional()
    .equals("I understand this action will archive the user")
    .withMessage("Incorrect confirmation phrase"),
];

// Restore User Validator
export const restoreUserValidator = [
  param("id").isMongoId().withMessage("Invalid user ID format"),
];

// Permanent Delete Validator
export const permanentDeleteValidator = [
  param("id").isMongoId().withMessage("Invalid user ID format"),
  body("confirmation")
    .notEmpty()
    .equals("I understand this action is irreversible and will permanently delete the user")
    .withMessage("Incorrect confirmation phrase"),
];

// Bulk Operations Validator
export const bulkArchiveValidator = [
  body("userIds")
    .isArray({ min: 1 }).withMessage("User IDs array required")
    .custom((value) => value.every(id => /^[0-9a-fA-F]{24}$/.test(id))),
];

export const bulkRestoreValidator = [
  body("userIds")
    .isArray({ min: 1 }).withMessage("User IDs array required")
    .custom((value) => value.every(id => /^[0-9a-fA-F]{24}$/.test(id))),
];

// Query Parameters Validator for GET /users
export const getUsersValidator = [
  query("search").optional().trim().isLength({ max: 100 }),
  query("role").optional().trim(),
  query("status").optional().isIn(["active", "inactive"]),
  query("isArchived").optional().toBoolean(),
  query("page").optional().toInt(),
  query("limit").optional().toInt(),
  query("sortBy").optional().isIn(["name", "email", "createdAt", "updatedAt", "lastLogin"]),
  query("sortOrder").optional().isIn(["asc", "desc"]),
];

// Query Parameters Validator for GET /users/archived
export const getArchivedUsersValidator = [
  query("search").optional().trim(),
  query("page").optional().toInt(),
  query("limit").optional().toInt(),
];