import { body, param } from "express-validator";

export const createPaymentValidator = [
  body("event")
    .optional()
    .isMongoId()
    .withMessage("Invalid event ID"),

  body("client")
    .optional()
    .isMongoId()
    .withMessage("Invalid client ID"),

  body("type")
    .notEmpty()
    .withMessage("Payment type is required")
    .isIn(["income", "expense"])
    .withMessage("Invalid payment type"),

  body("amount")
    .notEmpty()
    .withMessage("Amount is required")
    .isFloat({ min: 0 })
    .withMessage("Amount cannot be negative"),

  body("method")
    .notEmpty()
    .withMessage("Payment method is required")
    .isIn(["cash", "card", "credit_card", "bank_transfer", "check", "mobile_payment"])
    .withMessage("Invalid payment method"),

  body("status")
    .optional()
    .isIn(["pending", "completed", "failed", "refunded"])
    .withMessage("Invalid status"),

  body("dueDate")
    .optional()
    .isISO8601()
    .withMessage("Invalid due date format"),
];

export const updatePaymentValidator = [
  param("id")
    .isMongoId()
    .withMessage("Invalid payment ID"),

  body("status")
    .optional()
    .isIn(["pending", "completed", "failed", "refunded"])
    .withMessage("Invalid status"),

  body("paidDate")
    .optional()
    .isISO8601()
    .withMessage("Invalid paid date format"),
];