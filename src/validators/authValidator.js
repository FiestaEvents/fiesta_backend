import { body } from "express-validator";

// =========================================================
// CONFIGURATION & CONSTANTS
// =========================================================
const LIMITS = {
  NAME: { min: 2, max: 50 },
  EMAIL: { max: 100 },
  PASSWORD: { min: 8, max: 128 },
  PHONE: { max: 20 },
  VENUE_NAME: { min: 2, max: 100 },
  DESC: { max: 500 },
  ADDRESS: { max: 200 },
  CITY_STATE_COUNTRY: { max: 100 },
  URL: { max: 500 },
};

// =========================================================
// REUSABLE VALIDATION RULES
// =========================================================
const commonRules = {
  email: body("email")
    .trim()
    .notEmpty().withMessage("Email is required")
    .isEmail().withMessage("Please provide a valid email")
    .normalizeEmail()
    .isLength({ max: LIMITS.EMAIL.max }).withMessage(`Email too long (max ${LIMITS.EMAIL.max} chars)`),

  name: body("name")
    .trim()
    .notEmpty().withMessage("Name is required")
    .isLength(LIMITS.NAME).withMessage(`Name must be between ${LIMITS.NAME.min} and ${LIMITS.NAME.max} characters`),

  // Enforces strong password constraints (for Register/Reset/Change)
  strongPassword: (fieldName = "password") => 
    body(fieldName)
      .notEmpty().withMessage(`${fieldName} is required`)
      .isLength(LIMITS.PASSWORD).withMessage(`Password must be between ${LIMITS.PASSWORD.min} and ${LIMITS.PASSWORD.max} characters`),

  // Simple check for login (just existence)
  simplePassword: (fieldName = "password") =>
    body(fieldName).notEmpty().withMessage(`${fieldName} is required`),

  confirmPassword: (compareField = "password") =>
    body("confirmPassword")
      .notEmpty().withMessage("Please confirm your password")
      .custom((value, { req }) => {
        if (value !== req.body[compareField]) throw new Error("Passwords do not match");
        return true;
      }),

  phone: body("phone")
    .optional()
    .trim()
    .isMobilePhone("any").withMessage("Invalid phone number")
    .isLength({ max: LIMITS.PHONE.max }).withMessage(`Phone too long (max ${LIMITS.PHONE.max} chars)`),
};

// =========================================================
// ROUTE SPECIFIC VALIDATORS
// =========================================================

export const registerValidator = [
  commonRules.name,
  commonRules.email,
  commonRules.strongPassword("password"),
  commonRules.confirmPassword("password"),
  commonRules.phone,

  body("venueName")
    .trim()
    .notEmpty().withMessage("Venue name is required")
    .isLength(LIMITS.VENUE_NAME).withMessage(`Venue name must be between ${LIMITS.VENUE_NAME.min} and ${LIMITS.VENUE_NAME.max} chars`),

  body("description")
    .optional()
    .trim()
    .isLength({ max: LIMITS.DESC.max }).withMessage("Description too long"),

  body("address.street").optional().trim().isLength({ max: LIMITS.ADDRESS.max }),
  body("address.city").optional().trim().isLength({ max: LIMITS.CITY_STATE_COUNTRY.max }),
  body("address.state").optional().trim().isLength({ max: LIMITS.CITY_STATE_COUNTRY.max }),
  body("address.country").optional().trim().isLength({ max: LIMITS.CITY_STATE_COUNTRY.max }),
  body("address.zipCode").optional().trim().isPostalCode("any").withMessage("Invalid zip code"),
];

export const loginValidator = [
  commonRules.email,
  commonRules.simplePassword("password"),
];

export const emailValidator = [
  commonRules.email,
];

export const forgotPasswordValidator = [
  commonRules.email,
];

export const resetPasswordValidator = [
  commonRules.strongPassword("password"),
  commonRules.confirmPassword("password"),
  
  body("token")
    .notEmpty().withMessage("Reset token is required")
    .isLength({ min: 64, max: 64 }).withMessage("Invalid token length")
    .matches(/^[A-Fa-f0-9]+$/).withMessage("Invalid token format"),
];

export const restoreAccountValidator = [
  commonRules.email,
];

export const updateProfileValidator = [
  body("name")
    .optional()
    .trim()
    .isLength(LIMITS.NAME).withMessage(`Name must be between ${LIMITS.NAME.min} and ${LIMITS.NAME.max} characters`),

  commonRules.phone,

  body("avatar")
    .optional({ checkFalsy: true }) 
    .isURL().withMessage("Avatar must be a valid URL")
    .isLength({ max: LIMITS.URL.max }),
];

export const changePasswordValidator = [
  commonRules.simplePassword("currentPassword"),
  
  commonRules.strongPassword("newPassword")
    .custom((value, { req }) => {
      if (value === req.body.currentPassword) {
        throw new Error("New password must be different from current password");
      }
      return true;
    }),

  commonRules.confirmPassword("newPassword"),
];

export const archiveAccountValidator = [
  body("confirmation")
    .notEmpty().withMessage("Confirmation is required")
    .equals("I understand this action is irreversible")
    .withMessage("Confirmation phrase does not match"),
];