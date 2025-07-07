import mongoose from "mongoose"

const paymentSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true,
    },
    amount: {
      type: Number,
      required: [true, "Payment amount is required"],
      min: [0, "Amount cannot be negative"],
    },
    method: {
      type: String,
      required: [true, "Payment method is required"],
      enum: ["cash", "card", "bank-transfer", "check", "mobile-payment"],
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "refunded"],
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
      required: true,
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
      required: true,
    },
    venueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Venue",
      required: true,
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  },
)

// Calculate net amount before saving
paymentSchema.pre("save", function (next) {
  const totalFees = (this.fees.processingFee || 0) + (this.fees.platformFee || 0) + (this.fees.otherFees || 0)
  this.netAmount = this.amount - totalFees
  next()
})

// Index for payment queries
paymentSchema.index({ venueId: 1, status: 1 })
paymentSchema.index({ dueDate: 1 })

export default mongoose.model("Payment", paymentSchema)
