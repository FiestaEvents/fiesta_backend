import { body } from "express-validator";

// =========================================================
// CONFIGURATION
// =========================================================
const LIMITS = {
  NAME: { min: 2, max: 50 },
  EMAIL: { max: 100 },
  PASSWORD: { min: 8, max: 128 },
  PHONE: { max: 20 },
  BUSINESS_NAME: { min: 2, max: 100 },
  DESC: { max: 500 },
  ADDRESS: { max: 200 },
  CITY_STATE_COUNTRY: { max: 100 },
  URL: { max: 500 },
};

const VALID_CATEGORIES = [
  "venue", "photography", "videography", "catering", "bakery", 
  "florist", "decoration", "music", "entertainment", "driver", 
  "security", "planning", "makeup", "hair", "attire", "other"
];

// =========================================================
// RULES
// =========================================================
const commonRules = {
  email: body("email")
    .trim()
    .notEmpty().withMessage("Email is required")
    .isEmail().withMessage("Please provide a valid email")
    .normalizeEmail(),

  name: body("name")
    .trim()
    .notEmpty().withMessage("Name is required")
    // ✅ CRITICAL: No .custom() check here!
    .isLength(LIMITS.NAME).withMessage(`Name must be between ${LIMITS.NAME.min} and ${LIMITS.NAME.max} characters`),

  strongPassword: (field = "password") => body(field)
    .notEmpty().withMessage("Password is required")
    .isLength(LIMITS.PASSWORD).withMessage("Password too short"),

  phone: body("phone").optional().trim(),
};

// =========================================================
// EXPORTS
// =========================================================

export const registerValidator = [
  commonRules.name,
  commonRules.email,
  commonRules.strongPassword("password"),
  
  // Business Name
  body("businessName")
    .trim()
    .notEmpty().withMessage("Business Name is required")
    .isLength(LIMITS.BUSINESS_NAME).withMessage("Business name invalid"),

  // Category
  body("category")
    .trim()
    .notEmpty().withMessage("Category is required")
    .isIn(VALID_CATEGORIES).withMessage("Invalid category"),

  // Optional fields (No unique checks)
  body("description").optional().trim(),
  body("address.street").optional().trim(),
  body("serviceRadius").optional().isNumeric(),
  body("pricingModel").optional().isIn(['fixed', 'hourly']),
  body("spaces").optional().isArray()
];

export const loginValidator = [
  commonRules.email,
  body("password").notEmpty().withMessage("Password is required"),
];

// Other validators...
export const emailValidator = [commonRules.email];
export const forgotPasswordValidator = [commonRules.email];
export const resetPasswordValidator = [
  commonRules.strongPassword("password"),
  body("token").notEmpty()
];
export const restoreAccountValidator = [commonRules.email];
export const updateProfileValidator = [
  body("name").optional().trim().isLength(LIMITS.NAME),
  commonRules.phone
];
export const changePasswordValidator = [
  body("currentPassword").notEmpty(),
  commonRules.strongPassword("newPassword")
];
export const archiveAccountValidator = [
  body("confirmation").equals("I understand this action is irreversible")
];