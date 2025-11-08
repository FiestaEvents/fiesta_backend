import mongoose from "mongoose";

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
      enum: ["wedding", "birthday", "corporate", "conference", "party", "other"],
      required: [true, "Event type is required"],
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: [true, "Client is required"],
    },
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
    },
    endDate: {
      type: Date,
      required: [true, "End date is required"],
    },
    startTime: String,
    endTime: String,
    guestCount: {
      type: Number,
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
        default: 0,
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
        default: 0,
      },
    },
    payments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Payment",
      },
    ],
    paymentSummary: {
      totalAmount: { type: Number, default: 0 },
      paidAmount: { type: Number, default: 0 },
      status: {
        type: String,
        enum: ["pending", "partial", "paid", "overdue"],
        default: "pending",
      },
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
    },
  },
  {
    timestamps: true,
  }
);

// Validate that end date is after start date
eventSchema.pre("save", function (next) {
  if (this.endDate && this.startDate) {
    // Create dates without timezone issues
    const start = new Date(this.startDate);
    const end = new Date(this.endDate);
    
    // If same date, check times
    if (this.startDate === this.endDate && this.startTime ===this.endTime) {
      if (this.startTime >= this.endTime) {
        return next(new Error("End time must be after start time"));
      }
    }
    
    // Check if end date is before start date
    if (end < start) {
      return next(new Error("End date must be after start date"));
    }
  }
  next();
});

// Calculate total amount before saving
eventSchema.pre("save", function (next) {
  if (this.pricing) {
    let total = this.pricing.basePrice || 0;

    if (this.pricing.additionalServices && this.pricing.additionalServices.length > 0) {
      total += this.pricing.additionalServices.reduce(
        (sum, service) => sum + (service.price || 0),
        0
      );
    }

    total -= this.pricing.discount || 0;

    this.pricing.totalAmount = Math.max(0, total);
    this.paymentSummary.totalAmount = this.pricing.totalAmount;
  }
  next();
});

// Cascade delete related documents
eventSchema.pre("deleteOne", { document: true }, async function (next) {
  const eventId = this._id;

  const Task = mongoose.model("Task");
  const Reminder = mongoose.model("Reminder");
  const Payment = mongoose.model("Payment");
  const Finance = mongoose.model("Finance");

  await Promise.all([
    Task.deleteMany({ relatedEvent: eventId }),
    Reminder.deleteMany({ relatedEvent: eventId }),
    Payment.deleteMany({ event: eventId }),
    Finance.deleteMany({ relatedEvent: eventId }),
  ]);

  next();
});

eventSchema.index({ startDate: 1, endDate: 1 });
eventSchema.index({ venueId: 1, startDate: 1 });
eventSchema.index({ clientId: 1 });
eventSchema.index({ status: 1 });

export default mongoose.model("Event", eventSchema);