// src/models/Finance.js
const mongoose = require('mongoose');

const financeSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: [true, "Finance type is required"],
      enum: ["income", "expense"],
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      enum: [
        "event_revenue",
        "partner_payment",
        "utilities",
        "maintenance",    // Works for Venue maintenance or Vehicle repairs
        "marketing",
        "staff_salary",
        "equipment",      // Cameras, DJ decks, Ovens
        "insurance",
        "taxes",
        "supplies",       // New: Catering ingredients, cleaning products
        "fuel",           // New: Specific for Drivers/Logistics
        "other",
      ],
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [0, "Amount cannot be negative"],
    },
    
    // Archive / Soft Delete
    isArchived: { type: Boolean, default: false },
    archivedAt: { type: Date },
    archivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    date: {
      type: Date,
      required: [true, "Date is required"],
      default: Date.now,
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "card", "bank_transfer", "check"],
      default: "cash",
    },
    reference: {
      type: String,
      trim: true,
    },
    
    // Relationships
    relatedEvent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: function () {
        return this.category === "event_revenue";
      },
    },
    relatedPartner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Partner", // External vendor
      required: function () {
        return this.category === "partner_payment";
      },
    },
    
    receipt: {
      fileName: String,
      fileUrl: String, // Cloudinary/S3 URL
      uploadDate: { type: Date, default: Date.now },
    },
    
    taxInfo: {
      taxRate: { type: Number, default: 0 },
      taxAmount: { type: Number, default: 0 },
      taxIncluded: { type: Boolean, default: false },
    },
    
    status: {
      type: String,
      enum: ["pending", "completed", "cancelled"],
      default: "completed",
    },
    notes: {
      type: String,
      maxlength: [1000, "Notes cannot exceed 1000 characters"],
    },
    
    // =========================================================
    // ARCHITECTURE UPDATE: Replaces venueId
    // =========================================================
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    },
    
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
financeSchema.index({ businessId: 1, type: 1, date: -1 });
financeSchema.index({ category: 1, date: -1 });

module.exports = mongoose.model("Finance", financeSchema);