import { body, param } from "express-validator";

const commonRules = {
  mongoId: (field) =>
    body(field)
      .notEmpty()
      .withMessage(`${field} is required`)
      .isMongoId()
      .withMessage(`Invalid ${field} format`),

  optionalMongoId: (field) =>
    body(field)
      .optional({ checkFalsy: true })
      .isMongoId()
      .withMessage(`Invalid ${field} format`), // checkFalsy allows "" to be ignored

  amount: body("amount")
    .notEmpty()
    .withMessage("Amount is required")
    .isFloat({ min: 0.01 })
    .withMessage("Amount must be greater than 0"),

  status: body("status")
    .optional()
    .isIn(["pending", "completed", "failed", "refunded"])
    .withMessage("Invalid status"),
};

export const paymentIdValidator = [
  param("id").isMongoId().withMessage("Invalid payment ID"),
];

export const createPaymentValidator = [
  commonRules.amount,

  body("method")
    .notEmpty()
    .withMessage("Payment method is required")
    .isIn(["cash", "credit_card", "bank_transfer", "check", "online"])
    .withMessage("Invalid payment method"),

  // ✅ FIX: Allow empty string to pass as optional
  commonRules.optionalMongoId("invoiceId"),
  commonRules.optionalMongoId("clientId"),
  commonRules.optionalMongoId("eventId"),

  // Custom: At least one link
  body().custom((value, { req }) => {
    if (!req.body.invoiceId && !req.body.clientId && !req.body.eventId) {
      throw new Error("Payment must be linked to Invoice, Client, or Event");
    }
    return true;
  }),

  // Dates
  body("date").optional({ checkFalsy: true }).isISO8601().toDate(),
  body("dueDate").optional({ checkFalsy: true }).isISO8601().toDate(),
  body("paidDate").optional({ checkFalsy: true }).isISO8601().toDate(),

  body("reference").optional().trim().isLength({ max: 100 }),
  body("description").optional().trim().isLength({ max: 500 }),
];

export const updatePaymentValidator = [
  param("id").isMongoId().withMessage("Invalid payment ID"),
  commonRules.status,
  body("description").optional().trim().isLength({ max: 500 }),
];
