import { body, param, query } from "express-validator";

export const createClientValidator = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Client name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be between 2 and 100 characters")
    .matches(/^[a-zA-Z\s.'-]+$/)
    .withMessage("Name can only contain letters, spaces, apostrophes, hyphens, and periods"),

  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please provide a valid email")
    .normalizeEmail()
    .isLength({ max: 100 })
    .withMessage("Email must be less than 100 characters"),

  body("phone")
    .trim()
    .notEmpty()
    .withMessage("Phone is required")
    .isMobilePhone("any")
    .withMessage("Please provide a valid phone number")
    .isLength({ max: 20 })
    .withMessage("Phone number must be less than 20 characters"),

  body("company")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Company name cannot exceed 100 characters"),

  body("status")
    .optional()
    .isIn(["active", "inactive"])
    .withMessage("Invalid status"),

  body("address.street")
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Street address must be less than 200 characters"),

  body("address.city")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("City must be less than 100 characters"),

  body("address.state")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("State must be less than 100 characters"),

  body("address.zipCode")
    .optional()
    .trim()
    .isPostalCode("any")
    .withMessage("Please provide a valid zip/postal code"),

  body("address.country")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Country must be less than 100 characters"),

  body("notes")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Notes cannot exceed 1000 characters"),

  body("tags")
    .optional()
    .isArray()
    .withMessage("Tags must be an array"),
  
  body("tags.*")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Each tag cannot exceed 50 characters"),
];

export const updateClientValidator = [
  param("id")
    .isMongoId()
    .withMessage("Invalid client ID"),

  body("name")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Name cannot be empty")
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be between 2 and 100 characters")
    .matches(/^[a-zA-Z\s.'-]+$/)
    .withMessage("Name can only contain letters, spaces, apostrophes, hyphens, and periods"),

  body("email")
    .optional()
    .trim()
    .isEmail()
    .withMessage("Please provide a valid email")
    .normalizeEmail()
    .isLength({ max: 100 })
    .withMessage("Email must be less than 100 characters"),

  body("phone")
    .optional()
    .trim()
    .isMobilePhone("any")
    .withMessage("Please provide a valid phone number")
    .isLength({ max: 20 })
    .withMessage("Phone number must be less than 20 characters"),

  body("company")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Company name cannot exceed 100 characters"),

  body("status")
    .optional()
    .isIn(["active", "inactive"])
    .withMessage("Invalid status"),

  body("notes")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Notes cannot exceed 1000 characters"),
];

export const getClientValidator = [
  param("id")
    .isMongoId()
    .withMessage("Invalid client ID"),
];

export const archiveClientValidator = [
  param("id")
    .isMongoId()
    .withMessage("Invalid client ID"),

  body("confirmation")
    .optional()
    .isString()
    .withMessage("Confirmation must be a string")
    .custom((value, { req }) => {
      if (value && value !== "I understand this action will archive the client") {
        throw new Error("Please type the confirmation phrase exactly as shown");
      }
      return true;
    })
    .withMessage("Please type the confirmation phrase exactly as shown: 'I understand this action will archive the client'"),
];

export const restoreClientValidator = [
  param("id")
    .isMongoId()
    .withMessage("Invalid client ID"),
];

export const permanentDeleteClientValidator = [
  param("id")
    .isMongoId()
    .withMessage("Invalid client ID"),

  body("confirmation")
    .notEmpty()
    .withMessage("Confirmation is required")
    .equals("I understand this action is irreversible and will permanently delete the client")
    .withMessage("Please type the confirmation phrase exactly as shown: 'I understand this action is irreversible and will permanently delete the client'"),
];

export const bulkArchiveValidator = [
  body("clientIds")
    .isArray({ min: 1 })
    .withMessage("Client IDs array is required and must contain at least one client ID")
    .custom((value) => {
      return value.every(id => {
        try {
          return typeof id === 'string' && id.match(/^[0-9a-fA-F]{24}$/);
        } catch {
          return false;
        }
      });
    })
    .withMessage("All client IDs must be valid MongoDB IDs"),

  body("confirmation")
    .optional()
    .isString()
    .withMessage("Confirmation must be a string")
    .custom((value, { req }) => {
      if (value && value !== "I understand this action will archive multiple clients") {
        throw new Error("Please type the confirmation phrase exactly as shown");
      }
      return true;
    })
    .withMessage("Please type the confirmation phrase exactly as shown: 'I understand this action will archive multiple clients'"),
];

export const bulkRestoreValidator = [
  body("clientIds")
    .isArray({ min: 1 })
    .withMessage("Client IDs array is required and must contain at least one client ID")
    .custom((value) => {
      return value.every(id => {
        try {
          return typeof id === 'string' && id.match(/^[0-9a-fA-F]{24}$/);
        } catch {
          return false;
        }
      });
    })
    .withMessage("All client IDs must be valid MongoDB IDs"),
];

export const updateStatusValidator = [
  param("id")
    .isMongoId()
    .withMessage("Invalid client ID"),

  body("status")
    .notEmpty()
    .withMessage("Status is required")
    .isIn(["active", "inactive"])
    .withMessage("Status must be either 'active' or 'inactive'"),
];

export const addNoteValidator = [
  param("id")
    .isMongoId()
    .withMessage("Invalid client ID"),

  body("note")
    .trim()
    .notEmpty()
    .withMessage("Note content is required")
    .isLength({ max: 1000 })
    .withMessage("Note cannot exceed 1000 characters"),
];

export const updateTagsValidator = [
  param("id")
    .isMongoId()
    .withMessage("Invalid client ID"),

  body("tags")
    .isArray()
    .withMessage("Tags must be an array")
    .custom((tags) => {
      if (tags.length > 20) {
        throw new Error("Cannot have more than 20 tags");
      }
      return true;
    })
    .withMessage("Cannot have more than 20 tags"),
  
  body("tags.*")
    .trim()
    .notEmpty()
    .withMessage("Tag cannot be empty")
    .isLength({ max: 50 })
    .withMessage("Each tag cannot exceed 50 characters")
    .matches(/^[a-zA-Z0-9\s\-_]+$/)
    .withMessage("Tags can only contain letters, numbers, spaces, hyphens, and underscores"),
];

export const mergeClientsValidator = [
  body("primaryId")
    .notEmpty()
    .withMessage("Primary client ID is required")
    .isMongoId()
    .withMessage("Invalid primary client ID"),

  body("duplicateIds")
    .isArray({ min: 1 })
    .withMessage("Duplicate client IDs array is required and must contain at least one client ID")
    .custom((value) => {
      return value.every(id => {
        try {
          return typeof id === 'string' && id.match(/^[0-9a-fA-F]{24}$/);
        } catch {
          return false;
        }
      });
    })
    .withMessage("All duplicate client IDs must be valid MongoDB IDs")
    .custom((value, { req }) => {
      if (value.includes(req.body.primaryId)) {
        throw new Error("Primary client ID cannot be in duplicate IDs list");
      }
      return true;
    })
    .withMessage("Primary client ID cannot be in duplicate IDs list"),
];

export const quickCreateClientValidator = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Client name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be between 2 and 100 characters"),

  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please provide a valid email")
    .normalizeEmail(),

  body("phone")
    .trim()
    .notEmpty()
    .withMessage("Phone is required")
    .isMobilePhone("any")
    .withMessage("Please provide a valid phone number"),
];

export const getClientsValidator = [
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

  query("status")
    .optional()
    .isIn(["active", "inactive"])
    .withMessage("Invalid status"),

  query("search")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Search term must be less than 100 characters"),

  query("isArchived")
    .optional()
    .isBoolean()
    .withMessage("isArchived must be a boolean value")
    .toBoolean(),

  query("sortBy")
    .optional()
    .isIn(["name", "email", "createdAt", "updatedAt", "company"])
    .withMessage("Sort by must be one of: name, email, createdAt, updatedAt, company"),

  query("order")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("Order must be either 'asc' or 'desc'"),
];

export const getArchivedClientsValidator = [
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

  query("search")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Search term must be less than 100 characters"),
];

export const getClientEventsValidator = [
  param("id")
    .isMongoId()
    .withMessage("Invalid client ID"),

  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer")
    .toInt(),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("Limit must be between 1 and 50")
    .toInt(),

  query("status")
    .optional()
    .isIn(["pending", "confirmed", "in-progress", "completed", "cancelled"])
    .withMessage("Invalid status"),

  query("isArchived")
    .optional()
    .isBoolean()
    .withMessage("isArchived must be a boolean value")
    .toBoolean(),

  query("sortBy")
    .optional()
    .isIn(["startDate", "endDate", "createdAt", "title"])
    .withMessage("Sort by must be one of: startDate, endDate, createdAt, title"),

  query("order")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("Order must be either 'asc' or 'desc'"),
];

export const getClientPaymentsValidator = [
  param("id")
    .isMongoId()
    .withMessage("Invalid client ID"),

  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer")
    .toInt(),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("Limit must be between 1 and 50")
    .toInt(),

  query("startDate")
    .optional()
    .isISO8601()
    .withMessage("Invalid start date format"),

  query("endDate")
    .optional()
    .isISO8601()
    .withMessage("Invalid end date format"),
];

export const getClientTimelineValidator = [
  param("id")
    .isMongoId()
    .withMessage("Invalid client ID"),

  query("startDate")
    .optional()
    .isISO8601()
    .withMessage("Invalid start date format"),

  query("endDate")
    .optional()
    .isISO8601()
    .withMessage("Invalid end date format"),
];

export const getClientActivityLogValidator = [
  param("id")
    .isMongoId()
    .withMessage("Invalid client ID"),

  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer")
    .toInt(),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("Limit must be between 1 and 50")
    .toInt(),

  query("startDate")
    .optional()
    .isISO8601()
    .withMessage("Invalid start date format"),

  query("endDate")
    .optional()
    .isISO8601()
    .withMessage("Invalid end date format"),
];

export const exportClientsValidator = [
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
      const allowedFields = ["name", "email", "phone", "company", "status", "address", "notes", "tags", "createdAt"];
      if (value && value.length > 0) {
        return value.every(field => allowedFields.includes(field));
      }
      return true;
    })
    .withMessage("Fields can only include: name, email, phone, company, status, address, notes, tags, createdAt"),
];