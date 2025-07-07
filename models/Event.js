import mongoose from "mongoose"

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Event title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    description: {
      type: String,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
    type: {
      type: String,
      required: [true, "Event type is required"],
      enum: ["wedding", "birthday", "corporate", "conference", "party", "other"],
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true,
    },
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
    },
    endDate: {
      type: Date,
      required: [true, "End date is required"],
    },
    startTime: {
      type: String,
      required: [true, "Start time is required"],
    },
    endTime: {
      type: String,
      required: [true, "End time is required"],
    },
    guestCount: {
      type: Number,
      required: [true, "Guest count is required"],
      min: [1, "Guest count must be at least 1"],
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "in-progress", "completed", "cancelled"],
      default: "pending",
    },
    pricing: {
      basePrice: {
        type: Number,
        required: [true, "Base price is required"],
        min: [0, "Price cannot be negative"],
      },
      additionalServices: [
        {
          name: String,
          price: Number,
        },
      ],
      discount: {
        type: Number,
        default: 0,
        min: [0, "Discount cannot be negative"],
      },
      totalAmount: {
        type: Number,
        required: true,
      },
    },
    payment: {
      status: {
        type: String,
        enum: ["pending", "partial", "paid", "overdue"],
        default: "pending",
      },
      method: {
        type: String,
        enum: ["cash", "card", "bank-transfer", "check"],
        default: "cash",
      },
      paidAmount: {
        type: Number,
        default: 0,
      },
      dueDate: Date,
      transactions: [
        {
          amount: Number,
          method: String,
          date: { type: Date, default: Date.now },
          reference: String,
        },
      ],
    },
    partners: [
      {
        partner: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Partner",
        },
        service: String,
        cost: Number,
        status: {
          type: String,
          enum: ["pending", "confirmed", "completed"],
          default: "pending",
        },
      },
    ],
    requirements: {
      setup: String,
      catering: String,
      decoration: String,
      audioVisual: String,
      other: String,
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

// Validate that end date is after start date
eventSchema.pre("save", function (next) {
  if (this.endDate <= this.startDate) {
    next(new Error("End date must be after start date"))
  }
  next()
})

// Calculate total amount before saving
eventSchema.pre("save", function (next) {
  let total = this.pricing.basePrice

  // Add additional services
  if (this.pricing.additionalServices && this.pricing.additionalServices.length > 0) {
    total += this.pricing.additionalServices.reduce((sum, service) => sum + (service.price || 0), 0)
  }

  // Apply discount
  total -= this.pricing.discount || 0

  this.pricing.totalAmount = Math.max(0, total)
  next()
})

// Index for date range queries
eventSchema.index({ startDate: 1, endDate: 1 })
eventSchema.index({ venueId: 1, startDate: 1 })

export default mongoose.model("Event", eventSchema)
