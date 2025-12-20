//src/validators/userValidator.js
import { body, param, query } from "express-validator";

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

const roleIdValidation = body("roleId")
  .optional()
  .isMongoId()
  .withMessage("Invalid role ID format");

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
  
  emailValidation,
  
  passwordValidation,
  
  phoneValidation,
  
  body("roleId")
    .notEmpty()
    .withMessage("Role ID is required")
    .isMongoId()
    .withMessage("Invalid role ID format"),
  
  roleTypeValidation,
  
  isActiveValidation,

  body("customPermissions.granted")
    .optional()
    .isArray()
    .withMessage("Granted permissions must be an array")
    .custom((value) => {
      if (value && value.length > 0) {
        return value.every(id => {
          try {
            return typeof id === 'string' && id.match(/^[0-9a-fA-F]{24}$/);
          } catch {
            return false;
          }
        });
      }
      return true;
    })
    .withMessage("Granted permissions must contain valid permission IDs"),

  body("customPermissions.revoked")
    .optional()
    .isArray()
    .withMessage("Revoked permissions must be an array")
    .custom((value) => {
      if (value && value.length > 0) {
        return value.every(id => {
          try {
            return typeof id === 'string' && id.match(/^[0-9a-fA-F]{24}$/);
          } catch {
            return false;
          }
        });
      }
      return true;
    })
    .withMessage("Revoked permissions must contain valid permission IDs"),
];

// User Update Validator
export const updateUserValidator = [
  param("id")
    .isMongoId()
    .withMessage("Invalid user ID format"),

  nameValidation,

  body("email")
    .optional()
    .trim()
    .isEmail()
    .withMessage("Please provide a valid email")
    .normalizeEmail()
    .isLength({ max: 100 })
    .withMessage("Email must be less than 100 characters"),

  phoneValidation,

  roleIdValidation,

  roleTypeValidation,

  isActiveValidation,

  body("customPermissions")
    .optional()
    .isObject()
    .withMessage("Custom permissions must be an object"),

  body("customPermissions.granted")
    .optional()
    .isArray()
    .withMessage("Granted permissions must be an array")
    .custom((value) => {
      if (value && value.length > 0) {
        return value.every(id => {
          try {
            return typeof id === 'string' && id.match(/^[0-9a-fA-F]{24}$/);
          } catch {
            return false;
          }
        });
      }
      return true;
    })
    .withMessage("Granted permissions must contain valid permission IDs"),

  body("customPermissions.revoked")
    .optional()
    .isArray()
    .withMessage("Revoked permissions must be an array")
    .custom((value) => {
      if (value && value.length > 0) {
        return value.every(id => {
          try {
            return typeof id === 'string' && id.match(/^[0-9a-fA-F]{24}$/);
          } catch {
            return false;
          }
        });
      }
      return true;
    })
    .withMessage("Revoked permissions must contain valid permission IDs"),
];

// User ID Parameter Validator
export const userIdValidator = [
  param("id")
    .isMongoId()
    .withMessage("Invalid user ID format"),
];

// Archive User Validator
export const archiveUserValidator = [
  param("id")
    .isMongoId()
    .withMessage("Invalid user ID format"),

  body("confirmation")
    .optional()
    .isString()
    .withMessage("Confirmation must be a string")
    .custom((value, { req }) => {
      if (value && value !== "I understand this action will archive the user") {
        throw new Error("Please type the confirmation phrase exactly as shown");
      }
      return true;
    })
    .withMessage("Please type the confirmation phrase exactly as shown: 'I understand this action will archive the user'"),
];

// Restore User Validator
export const restoreUserValidator = [
  param("id")
    .isMongoId()
    .withMessage("Invalid user ID format"),
];

// Permanent Delete Validator
export const permanentDeleteValidator = [
  param("id")
    .isMongoId()
    .withMessage("Invalid user ID format"),

  body("confirmation")
    .notEmpty()
    .withMessage("Confirmation is required")
    .equals("I understand this action is irreversible and will permanently delete the user")
    .withMessage("Please type the confirmation phrase exactly as shown: 'I understand this action is irreversible and will permanently delete the user'"),
];

// Bulk Operations Validator
export const bulkArchiveValidator = [
  body("userIds")
    .isArray({ min: 1 })
    .withMessage("User IDs array is required and must contain at least one user ID")
    .custom((value) => {
      return value.every(id => {
        try {
          return typeof id === 'string' && id.match(/^[0-9a-fA-F]{24}$/);
        } catch {
          return false;
        }
      });
    })
    .withMessage("All user IDs must be valid MongoDB IDs"),

  body("confirmation")
    .optional()
    .isString()
    .withMessage("Confirmation must be a string")
    .custom((value, { req }) => {
      if (value && value !== "I understand this action will archive multiple users") {
        throw new Error("Please type the confirmation phrase exactly as shown");
      }
      return true;
    })
    .withMessage("Please type the confirmation phrase exactly as shown: 'I understand this action will archive multiple users'"),
];

export const bulkRestoreValidator = [
  body("userIds")
    .isArray({ min: 1 })
    .withMessage("User IDs array is required and must contain at least one user ID")
    .custom((value) => {
      return value.every(id => {
        try {
          return typeof id === 'string' && id.match(/^[0-9a-fA-F]{24}$/);
        } catch {
          return false;
        }
      });
    })
    .withMessage("All user IDs must be valid MongoDB IDs"),
];

// Status Update Validator
export const updateStatusValidator = [
  param("id")
    .isMongoId()
    .withMessage("Invalid user ID format"),

  body("status")
    .notEmpty()
    .withMessage("Status is required")
    .isIn(["active", "inactive"])
    .withMessage("Status must be either 'active' or 'inactive'"),
];

// Role Update Validator
export const updateRoleValidator = [
  param("id")
    .isMongoId()
    .withMessage("Invalid user ID format"),

  body("roleId")
    .notEmpty()
    .withMessage("Role ID is required")
    .isMongoId()
    .withMessage("Invalid role ID format"),
];

// Query Parameters Validator for GET /users
export const getUsersValidator = [
  query("search")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Search term must be less than 100 characters"),

  query("role")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Role filter must be less than 50 characters"),

  query("status")
    .optional()
    .isIn(["active", "inactive"])
    .withMessage("Status must be either 'active' or 'inactive'"),

  query("isArchived")
    .optional()
    .isBoolean()
    .withMessage("isArchived must be a boolean value")
    .toBoolean(),

  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer")
    .toInt(),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100")
    .toInt(),

  query("sortBy")
    .optional()
    .isIn(["name", "email", "createdAt", "updatedAt", "lastLogin"])
    .withMessage("Sort by must be one of: name, email, createdAt, updatedAt, lastLogin"),

  query("sortOrder")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("Sort order must be either 'asc' or 'desc'"),
];

// Query Parameters Validator for GET /users/archived
export const getArchivedUsersValidator = [
  query("search")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Search term must be less than 100 characters"),

  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer")
    .toInt(),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100")
    .toInt(),
];

// Avatar Upload Validator
export const uploadAvatarValidator = [
  param("id")
    .isMongoId()
    .withMessage("Invalid user ID format"),

  // Note: File validation is typically handled by multer or similar middleware
  // This validator focuses on the user ID parameter
];

// User Search Validator
export const searchUsersValidator = [
  query("q")
    .notEmpty()
    .withMessage("Search query is required")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Search query must be between 2 and 100 characters"),

  query("field")
    .optional()
    .isIn(["name", "email", "phone", "all"])
    .withMessage("Field must be one of: name, email, phone, all"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("Limit must be between 1 and 50")
    .toInt(),
];

// Export Users Validator
export const exportUsersValidator = [
  query("format")
    .optional()
    .isIn(["csv", "json", "xlsx"])
    .withMessage("Format must be one of: csv, json, xlsx"),

  query("includeArchived")
    .optional()
    .isBoolean()
    .withMessage("includeArchived must be a boolean value")
    .toBoolean(),

  query("fields")
    .optional()
    .isArray()
    .withMessage("Fields must be an array")
    .custom((value) => {
      const allowedFields = ["name", "email", "phone", "role", "status", "lastLogin", "createdAt"];
      if (value && value.length > 0) {
        return value.every(field => allowedFields.includes(field));
      }
      return true;
    })
    .withMessage("Fields can only include: name, email, phone, role, status, lastLogin, createdAt"),
];

// Custom Permissions Validator
export const updateCustomPermissionsValidator = [
  param("id")
    .isMongoId()
    .withMessage("Invalid user ID format"),

  body("granted")
    .optional()
    .isArray()
    .withMessage("Granted permissions must be an array")
    .custom((value) => {
      if (value && value.length > 0) {
        return value.every(id => {
          try {
            return typeof id === 'string' && id.match(/^[0-9a-fA-F]{24}$/);
          } catch {
            return false;
          }
        });
      }
      return true;
    })
    .withMessage("Granted permissions must contain valid permission IDs"),

  body("revoked")
    .optional()
    .isArray()
    .withMessage("Revoked permissions must be an array")
    .custom((value) => {
      if (value && value.length > 0) {
        return value.every(id => {
          try {
            return typeof id === 'string' && id.match(/^[0-9a-fA-F]{24}$/);
          } catch {
            return false;
          }
        });
      }
      return true;
    })
    .withMessage("Revoked permissions must contain valid permission IDs"),

  body("action")
    .notEmpty()
    .withMessage("Action is required")
    .isIn(["add", "remove", "replace"])
    .withMessage("Action must be one of: add, remove, replace"),
];

// Invite User Validator (for sending invitations)
export const inviteUserValidator = [
  nameValidation,

  emailValidation,

  body("roleId")
    .notEmpty()
    .withMessage("Role ID is required")
    .isMongoId()
    .withMessage("Invalid role ID format"),

  roleTypeValidation,

  body("message")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Invitation message must be less than 500 characters"),
];

// User Import Validator (for bulk user creation)
export const importUsersValidator = [
  body("users")
    .isArray({ min: 1, max: 100 })
    .withMessage("Users array is required and must contain between 1 and 100 users"),

  body("users.*.name")
    .notEmpty()
    .withMessage("User name is required")
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("User name must be between 2 and 50 characters"),

  body("users.*.email")
    .notEmpty()
    .withMessage("User email is required")
    .isEmail()
    .withMessage("Please provide a valid email")
    .normalizeEmail(),

  body("users.*.roleId")
    .notEmpty()
    .withMessage("Role ID is required")
    .isMongoId()
    .withMessage("Invalid role ID format"),

  body("users.*.roleType")
    .optional()
    .isIn(["owner", "manager", "staff", "viewer", "custom"])
    .withMessage("Role type must be one of: owner, manager, staff, viewer, custom"),

  body("sendInvitations")
    .optional()
    .isBoolean()
    .withMessage("sendInvitations must be a boolean value"),
];