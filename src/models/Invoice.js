// src/models/Invoice.js
const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema(
  {
    // =========================================================
    // ARCHITECTURE UPDATE: Replaces venue
    // =========================================================
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    
    invoiceNumber: {
      type: String,
      // Global uniqueness removed. Uniqueness is now enforced per-business via compound index below.
      required: true
    },
    
    invoiceType: {
      type: String,
      enum: ["client", "partner"],
      default: "client",
    },
    status: {
      type: String,
      enum: ["draft", "sent", "paid", "partial", "overdue", "cancelled"],
      default: "draft",
      index: true,
    },
    
    // Relationships
    client: { type: mongoose.Schema.Types.ObjectId, ref: "Client" },
    partner: { type: mongoose.Schema.Types.ObjectId, ref: "Partner" },
    event: { type: mongoose.Schema.Types.ObjectId, ref: "Event" },
    
    // Snapshot Data (Preserves history if Client/Partner is deleted)
    recipientName: String,
    recipientEmail: String,
    recipientPhone: String,
    recipientAddress: String,
    recipientCompany: String,

    // Dates
    issueDate: { type: Date, default: Date.now },
    dueDate: { type: Date, required: true },
    
    // Financials
    currency: { type: String, default: "TND" },
    items: [
      {
        description: String,
        quantity: { type: Number, default: 1 },
        rate: { type: Number, default: 0 },
        amount: { type: Number, default: 0 },
      },
    ],
    subtotal: { type: Number, default: 0 },
    taxRate: { type: Number, default: 0 }, // Percentage
    taxAmount: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    
    // Payment Tracking
    paymentStatus: {
      amountPaid: { type: Number, default: 0 },
      amountDue: { type: Number, default: 0 },
      lastPaymentDate: Date,
    },
    
    // Text Fields
    notes: String,
    terms: String,
    
    // Meta
    isArchived: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    sentAt: Date,
  },
  { timestamps: true }
);

// COMPOUND INDEX: Ensures uniqueness PER BUSINESS
// Example: Business A can have INV-25-0001 and Business B can also have INV-25-0001
invoiceSchema.index({ business: 1, invoiceNumber: 1 }, { unique: true });

// Auto-generate Invoice Number (INV-YY-0001)
invoiceSchema.pre("validate", async function (next) {
  if (this.isNew && !this.invoiceNumber) {
    // Count existing invoices for THIS Business only
    const count = await this.constructor.countDocuments({ business: this.business });
    
    const year = new Date().getFullYear().toString().slice(-2);
    const prefix = this.invoiceType === 'client' ? 'INV' : 'BILL';
    
    // Format: INV-25-0001
    this.invoiceNumber = `${prefix}-${year}-${(count + 1).toString().padStart(4, "0")}`;
  }
  next();
});

module.exports = mongoose.model("Invoice", invoiceSchema);