import { body, param } from "express-validator";

// =========================================================
// REUSABLE RULES
// =========================================================
const commonRules = {
  mongoId: (field) => 
    body(field)
      .notEmpty().withMessage(`${field} is required`)
      .isMongoId().withMessage(`Invalid ${field} format`),
  
  optionalMongoId: (field) =>
    body(field)
      .optional()
      .isMongoId().withMessage(`Invalid ${field} format`),

  amount: body("amount")
    .notEmpty().withMessage("Amount is required")
    .isFloat({ min: 0.01 }).withMessage("Amount must be greater than 0"),

  date: body("date")
    .optional()
    .isISO8601().withMessage("Invalid date format")
    .toDate(),

  method: body("method")
    .notEmpty().withMessage("Payment method is required")
    .isIn(["cash", "credit_card", "bank_transfer", "check", "online"])
    .withMessage("Invalid payment method"),
    
  status: body("status")
    .optional()
    .isIn(["pending", "completed", "failed", "refunded"])
    .withMessage("Invalid status"),
};

// =========================================================
// ID VALIDATOR
// =========================================================
export const paymentIdValidator = [
  param("id").isMongoId().withMessage("Invalid payment ID"),
];

// =========================================================
// CREATE VALIDATOR
// =========================================================
export const createPaymentValidator = [
  commonRules.amount,
  commonRules.method,
  
  // Link to either Invoice OR Client directly
  body("invoiceId").optional().isMongoId().withMessage("Invalid Invoice ID"),
  body("clientId").optional().isMongoId().withMessage("Invalid Client ID"),
  
  // Custom validator: Ensure at least one link exists
  body().custom((value, { req }) => {
    if (!req.body.invoiceId && !req.body.clientId) {
      throw new Error("Payment must be linked to either an Invoice or a Client");
    }
    return true;
  }),

  commonRules.date,
  
  body("reference")
    .optional()
    .trim()
    .isLength({ max: 100 }),
    
  body("notes")
    .optional()
    .trim()
    .isLength({ max: 500 }),
];

// =========================================================
// UPDATE VALIDATOR
// =========================================================
export const updatePaymentValidator = [
  param("id").isMongoId().withMessage("Invalid payment ID"),
  
  commonRules.status,
  
  body("notes")
    .optional()
    .trim()
    .isLength({ max: 500 }),
    
  // Prevent changing amount/method after creation for audit trail (optional policy)
  // If allowed, uncomment below:
  // body("amount").optional().isFloat({ min: 0.01 }),
  // body("method").optional().isIn([...]),
];