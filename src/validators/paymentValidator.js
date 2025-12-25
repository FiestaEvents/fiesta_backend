import { body, param } from "express-validator";
import { Invoice, Client, Event } from "../models/index.js";

const commonRules = {
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

  // ✅ TENANT ISOLATION: Invoice Check
  body("invoiceId")
    .optional({ checkFalsy: true }) // Allow empty string
    .isMongoId().withMessage("Invalid Invoice ID")
    .custom(async (val, { req }) => {
      const invoice = await Invoice.findOne({ 
        _id: val, 
        businessId: req.user.businessId 
      });
      if (!invoice) throw new Error("Invoice not found or does not belong to your business");
      return true;
    }),

  // ✅ TENANT ISOLATION: Client Check
  body("clientId")
    .optional({ checkFalsy: true })
    .isMongoId().withMessage("Invalid Client ID")
    .custom(async (val, { req }) => {
      const client = await Client.findOne({ 
        _id: val, 
        businessId: req.user.businessId 
      });
      if (!client) throw new Error("Client not found or does not belong to your business");
      return true;
    }),

  // ✅ TENANT ISOLATION: Event Check
  body("eventId")
    .optional({ checkFalsy: true })
    .isMongoId().withMessage("Invalid Event ID")
    .custom(async (val, { req }) => {
      const event = await Event.findOne({ 
        _id: val, 
        businessId: req.user.businessId 
      });
      if (!event) throw new Error("Event not found or does not belong to your business");
      return true;
    }),

  // Custom: At least one link required
  body().custom((value, { req }) => {
    // Check if at least one of the IDs is provided (truthy check handles null/undefined/empty string)
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
  
  // Type (Income/Expense) - Optional, defaults to income in controller usually
  body("type").optional().isIn(["income", "expense"]),
];

export const updatePaymentValidator = [
  param("id").isMongoId().withMessage("Invalid payment ID"),
  
  commonRules.status,
  
  body("description").optional().trim().isLength({ max: 500 }),
  body("date").optional({ checkFalsy: true }).isISO8601().toDate(),
  body("reference").optional().trim().isLength({ max: 100 }),
];