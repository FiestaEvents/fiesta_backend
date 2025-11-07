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
    type: {
      type: String,
      required: [true, "Payment type is required"],
      enum: ["income", "expense"],
      default: "income",
    },
    amount: {
      type: Number,
      required: [true, "Payment amount is required"],
      min: [0, "Amount cannot be negative"],
    },
    method: {
      type: String,
      required: [true, "Payment method is required"],
      enum: ["cash", "card", "credit_card", "bank_transfer", "check", "mobile_payment"],
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "refunded", "partial"],
      default: "pending",
    },
    reference: {
      type: String,
      trim: true,
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
    fees: {
      processingFee: { type: Number, default: 0 },
      platformFee: { type: Number, default: 0 },
      otherFees: { type: Number, default: 0 },
    },
    netAmount: {
      type: Number,
    },
    venueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Venue",
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
  this.netAmount = this.amount - totalFees - (this.refundAmount || 0);
  next();
});

paymentSchema.index({ venueId: 1, status: 1 });
paymentSchema.index({ venueId: 1, type: 1 });
paymentSchema.index({ dueDate: 1 });
paymentSchema.index({ event: 1 });

export default mongoose.model("Payment", paymentSchema);