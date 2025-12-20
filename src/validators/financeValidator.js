// src/validators/financeValidator.js
import { body, param } from "express-validator";

export const financeIdValidator = [
  param("id").isMongoId().withMessage("Invalid finance record ID"),
];

export const createFinanceValidator = [
  body("type").isIn(["income", "expense"]).withMessage("Invalid type (income/expense)"),
  body("category").notEmpty().withMessage("Category is required"),
  body("description").notEmpty().withMessage("Description is required"),
  body("amount").isFloat({ min: 0 }).withMessage("Amount must be a positive number"),
  body("date").isISO8601().withMessage("Invalid date format"),
];

export const updateFinanceValidator = [
  param("id").isMongoId().withMessage("Invalid finance record ID"),
  // Add optional body checks here if updates have specific rules
  body("amount").optional().isFloat({ min: 0 }).withMessage("Amount must be a positive number"),
  body("type").optional().isIn(["income", "expense"]),
];