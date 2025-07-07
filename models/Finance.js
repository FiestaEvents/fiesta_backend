import mongoose from "mongoose"

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
        "event-revenue",
        "partner-payment",
        "utilities",
        "maintenance",
        "marketing",
        "staff-salary",
        "equipment",
        "insurance",
        "taxes",
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
    date: {
      type: Date,
      required: [true, "Date is required"],
      default: Date.now,
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "card", "bank-transfer", "check"],
      default: "cash",
    },
    reference: {
      type: String,
      trim: true,
    },
    relatedEvent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
    },
    relatedPartner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Partner",
    },
    receipt: {
      fileName: String,
      fileUrl: String,
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
    venueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Venue",
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  },
)

// Index for financial reporting
financeSchema.index({ venueId: 1, type: 1, date: -1 })
financeSchema.index({ category: 1, date: -1 })

export default mongoose.model("Finance", financeSchema)
