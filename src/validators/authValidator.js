import { body } from "express-validator";

// =========================================================
// PASSWORD REQUIREMENTS (Simplified)
// =========================================================
const PASSWORD_REQUIREMENTS = {
  MIN_LENGTH: 8,
  MAX_LENGTH: 128,
  ERROR_MESSAGE: "Password must be at least 8 characters long"
};

// =========================================================
// REGISTER VALIDATOR
// =========================================================
export const registerValidator = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("Name must be between 2 and 50 characters"),

  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please provide a valid email")
    .normalizeEmail()
    .isLength({ max: 100 })
    .withMessage("Email must be less than 100 characters"),

  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: PASSWORD_REQUIREMENTS.MIN_LENGTH })
    .withMessage(PASSWORD_REQUIREMENTS.ERROR_MESSAGE)
    .isLength({ max: PASSWORD_REQUIREMENTS.MAX_LENGTH })
    .withMessage(`Password must be less than ${PASSWORD_REQUIREMENTS.MAX_LENGTH} characters`),

  body("confirmPassword")
    .notEmpty()
    .withMessage("Please confirm your password")
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error("Passwords do not match");
      }
      return true;
    }),

  body("venueName")
    .trim()
    .notEmpty()
    .withMessage("Venue name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Venue name must be between 2 and 100 characters"),

  body("phone")
    .optional()
    .trim()
    .isMobilePhone()
    .withMessage("Please provide a valid phone number")
    .isLength({ max: 20 })
    .withMessage("Phone number must be less than 20 characters"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description must be less than 500 characters"),

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
];

// =========================================================
// LOGIN VALIDATOR
// =========================================================
export const loginValidator = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please provide a valid email")
    .normalizeEmail()
    .isLength({ max: 100 })
    .withMessage("Email must be less than 100 characters"),

  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 1 })
    .withMessage("Password is required"),
];

// =========================================================
// EMAIL VALIDATOR (Generic)
// =========================================================
export const emailValidator = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please provide a valid email")
    .normalizeEmail()
    .isLength({ max: 100 })
    .withMessage("Email must be less than 100 characters"),
];

// =========================================================
// FORGOT PASSWORD VALIDATOR
// =========================================================
export const forgotPasswordValidator = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please provide a valid email")
    .normalizeEmail()
    .isLength({ max: 100 })
    .withMessage("Email must be less than 100 characters"),
];

// =========================================================
// RESET PASSWORD VALIDATOR
// =========================================================
export const resetPasswordValidator = [
  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: PASSWORD_REQUIREMENTS.MIN_LENGTH })
    .withMessage(PASSWORD_REQUIREMENTS.ERROR_MESSAGE)
    .isLength({ max: PASSWORD_REQUIREMENTS.MAX_LENGTH })
    .withMessage(`Password must be less than ${PASSWORD_REQUIREMENTS.MAX_LENGTH} characters`),

  body("confirmPassword")
    .notEmpty()
    .withMessage("Please confirm your password")
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error("Passwords do not match");
      }
      return true;
    }),
  
  body("token")
    .notEmpty()
    .withMessage("Reset token is required")
    .isLength({ min: 64, max: 64 })
    .withMessage("Invalid reset token format")
    .matches(/^[A-Fa-f0-9]+$/)
    .withMessage("Reset token contains invalid characters"),
];

// =========================================================
// RESTORE ACCOUNT VALIDATOR
// =========================================================
export const restoreAccountValidator = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please provide a valid email")
    .normalizeEmail()
    .isLength({ max: 100 })
    .withMessage("Email must be less than 100 characters"),
];

// =========================================================
// UPDATE PROFILE VALIDATOR
// =========================================================
export const updateProfileValidator = [
  body("name")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Name cannot be empty")
    .isLength({ min: 2, max: 50 })
    .withMessage("Name must be between 2 and 50 characters"),

  body("phone")
    .optional()
    .trim()
    .isMobilePhone()
    .withMessage("Please provide a valid phone number")
    .isLength({ max: 20 })
    .withMessage("Phone number must be less than 20 characters"),

  body("avatar")
    .optional()
    .isURL()
    .withMessage("Avatar must be a valid URL")
    .isLength({ max: 500 })
    .withMessage("Avatar URL must be less than 500 characters"),
];

// =========================================================
// CHANGE PASSWORD VALIDATOR
// =========================================================
export const changePasswordValidator = [
  body("currentPassword")
    .notEmpty()
    .withMessage("Current password is required")
    .isLength({ min: 1 })
    .withMessage("Current password is required"),

  body("newPassword")
    .notEmpty()
    .withMessage("New password is required")
    .isLength({ min: PASSWORD_REQUIREMENTS.MIN_LENGTH })
    .withMessage(PASSWORD_REQUIREMENTS.ERROR_MESSAGE)
    .isLength({ max: PASSWORD_REQUIREMENTS.MAX_LENGTH })
    .withMessage(`New password must be less than ${PASSWORD_REQUIREMENTS.MAX_LENGTH} characters`)
    .custom((value, { req }) => {
      if (value === req.body.currentPassword) {
        throw new Error("New password must be different from current password");
      }
      return true;
    }),

  body("confirmPassword")
    .notEmpty()
    .withMessage("Please confirm your new password")
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error("Passwords do not match");
      }
      return true;
    }),
];

// =========================================================
// ARCHIVE ACCOUNT VALIDATOR
// =========================================================
export const archiveAccountValidator = [
  body("confirmation")
    .notEmpty()
    .withMessage("Confirmation is required")
    .equals("I understand this action is irreversible")
    .withMessage("Please type the confirmation phrase exactly as shown"),
];