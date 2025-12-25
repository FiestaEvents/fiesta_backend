import { body, param } from "express-validator";
import { Event, Partner } from "../models/index.js";

// Valid categories matching the Finance Model
const VALID_CATEGORIES = [
  "event_revenue",
  "partner_payment",
  "utilities",
  "maintenance",
  "marketing",
  "staff_salary",
  "equipment",
  "insurance",
  "taxes",
  "other",
];

export const financeIdValidator = [
  param("id").isMongoId().withMessage("Invalid finance record ID"),
];

export const createFinanceValidator = [
  body("type")
    .isIn(["income", "expense"])
    .withMessage("Type must be either 'income' or 'expense'"),

  body("category")
    .notEmpty().withMessage("Category is required")
    .isIn(VALID_CATEGORIES).withMessage(`Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}`),

  body("description")
    .trim()
    .notEmpty().withMessage("Description is required")
    .isLength({ max: 500 }).withMessage("Description too long"),

  body("amount")
    .isFloat({ min: 0 })
    .withMessage("Amount must be a positive number"),

  body("date")
    .isISO8601()
    .toDate()
    .withMessage("Invalid date format"),

  body("paymentMethod")
    .optional()
    .isIn(["cash", "card", "bank_transfer", "check"]),

  // ✅ CONDITIONAL: Require Event ID if category is event_revenue
  body("relatedEvent")
    .if(body("category").equals("event_revenue"))
    .notEmpty().withMessage("Related Event is required for event revenue")
    .isMongoId().withMessage("Invalid Event ID")
    .custom(async (val, { req }) => {
       // Tenant Isolation Check
       const event = await Event.findOne({ 
         _id: val, 
         businessId: req.user.businessId 
       });
       if (!event) throw new Error("Event not found or does not belong to your business");
       return true;
    }),

  // ✅ CONDITIONAL: Require Partner ID if category is partner_payment
  body("relatedPartner")
    .if(body("category").equals("partner_payment"))
    .notEmpty().withMessage("Related Partner is required for partner payments")
    .isMongoId().withMessage("Invalid Partner ID")
    .custom(async (val, { req }) => {
       // Tenant Isolation Check
       const partner = await Partner.findOne({ 
         _id: val, 
         businessId: req.user.businessId 
       });
       if (!partner) throw new Error("Partner not found or does not belong to your business");
       return true;
    }),
];

export const updateFinanceValidator = [
  param("id").isMongoId().withMessage("Invalid finance record ID"),
  
  body("amount")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Amount must be positive"),
    
  body("type")
    .optional()
    .isIn(["income", "expense"]),

  body("category")
    .optional()
    .isIn(VALID_CATEGORIES),

  // If updating relations, re-verify ownership
  body("relatedEvent")
    .optional()
    .isMongoId()
    .custom(async (val, { req }) => {
       const event = await Event.findOne({ 
         _id: val, 
         businessId: req.user.businessId 
       });
       if (!event) throw new Error("Event not found or does not belong to your business");
       return true;
    }),

  body("relatedPartner")
    .optional()
    .isMongoId()
    .custom(async (val, { req }) => {
       const partner = await Partner.findOne({ 
         _id: val, 
         businessId: req.user.businessId 
       });
       if (!partner) throw new Error("Partner not found or does not belong to your business");
       return true;
    }),
];