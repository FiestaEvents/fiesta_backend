import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
    },
    
    // Income (Client pays Business) vs Expense (Business pays Partner)
    type: {
      type: String,
      required: [true, "Payment type is required"],
      enum: ["income", "expense"],
      default: "income",
    },
    
    // Archive / Soft Delete
    isArchived: { type: Boolean, default: false },
    archivedAt: { type: Date },
    archivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  
    amount: {
      type: Number,
      required: [true, "Payment amount is required"],
      min: [0, "Amount cannot be negative"],
    },
    method: {
      type: String,
      required: [true, "Payment method is required"],
      enum: [
        "cash",
        "card",
        "credit_card",
        "bank_transfer",
        "check",
        "mobile_payment",
      ],
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "refunded", "partial"],
      default: "pending",
    },
    reference: {
      type: String,
      trim: true, // Check number or Transaction ID
    },
    description: {
      type: String,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    dueDate: {
      type: Date,
    },
    paidDate: {
      type: Date,
    },
    
    // Refund Logic
    refundAmount: {
      type: Number,
      default: 0,
      min: [0, "Refund amount cannot be negative"],
    },
    refundDate: {
      type: Date,
    },
    refundReason: {
      type: String,
      maxlength: [500, "Refund reason cannot exceed 500 characters"],
    },
    
    // Platform/Processing Fees
    fees: {
      processingFee: { type: Number, default: 0 },
      platformFee: { type: Number, default: 0 },
      otherFees: { type: Number, default: 0 },
    },
    netAmount: {
      type: Number, // Calculated automatically
    },
    
    // =========================================================
    // ARCHITECTURE UPDATE: Replaces venueId
    // =========================================================
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    },
    
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Calculate net amount before saving
paymentSchema.pre("save", function (next) {
  const totalFees =
    (this.fees?.processingFee || 0) +
    (this.fees?.platformFee || 0) +
    (this.fees?.otherFees || 0);
  
  // Net = Amount collected - Fees - Refunds
  this.netAmount = this.amount - totalFees - (this.refundAmount || 0);
  next();
});

// Indexes
paymentSchema.index({ businessId: 1, status: 1 });
paymentSchema.index({ businessId: 1, type: 1 });
paymentSchema.index({ dueDate: 1 });
paymentSchema.index({ event: 1 });

export default mongoose.model("Payment", paymentSchema);