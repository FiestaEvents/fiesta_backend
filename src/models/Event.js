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
    startTime: {
      type: String,
      required: [true, "Start time is required"], // Ensure time is present for collision check
    },
    endTime: {
      type: String,
      required: [true, "End time is required"], // Ensure time is present for collision check
    },
    guestCount: {
      type: Number,
      min: [1, "Guest count must be at least 1"],
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "in-progress", "completed", "cancelled"],
      default: "pending",
    },
    
    // Archive fields
    isArchived: { 
      type: Boolean, 
      default: false 
    },
    archivedAt: { 
      type: Date 
    },
    archivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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
      discountType: {
        type: String,
        enum: ["fixed", "percentage"],
        default: "fixed",
      },
      taxRate: {
        type: Number,
        default: 19,
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
        hours: Number,
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
    venueSpaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "VenueSpace",
      required: true,
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

// ======================================================
// 1. HELPER: Combine Date and Time String into Date Object
// ======================================================
const createDateTime = (date, timeStr) => {
  if (!date || !timeStr) return null;
  const d = new Date(date);
  const [hours, minutes] = timeStr.split(':');
  d.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  return d;
};

// ======================================================
// 2. MIDDLEWARE: Collision Detection
// ======================================================
eventSchema.pre("save", async function (next) {
  // Only run check if scheduling fields are modified
  if (
    this.isModified("venueSpaceId") ||
    this.isModified("startDate") ||
    this.isModified("endDate") ||
    this.isModified("startTime") ||
    this.isModified("endTime") ||
    this.isNew
  ) {
    
    // Basic logical validation
    const startDateTime = createDateTime(this.startDate, this.startTime);
    const endDateTime = createDateTime(this.endDate, this.endTime);

    if (startDateTime && endDateTime && endDateTime <= startDateTime) {
      return next(new Error("End time must be after start time"));
    }

    // --- COLLISION CHECK ---
    const Event = mongoose.model("Event");
    
    // Find potential conflicts in the SAME Venue Space
    const potentialConflicts = await Event.find({
      venueSpaceId: this.venueSpaceId, // Scope to specific space
      status: { $ne: "cancelled" },    // Ignore cancelled events
      isArchived: { $ne: true },       // Ignore archived events
      _id: { $ne: this._id },          // Exclude current event (if editing)
      // Optimization: Only look for events that overlap dates roughly first
      $or: [
        { startDate: { $lte: this.endDate }, endDate: { $gte: this.startDate } }
      ]
    });

    // Precise Time Check
    const hasConflict = potentialConflicts.some(existing => {
      const existingStart = createDateTime(existing.startDate, existing.startTime);
      const existingEnd = createDateTime(existing.endDate, existing.endTime);

      // Overlap Logic: (StartA < EndB) and (EndA > StartB)
      return startDateTime < existingEnd && endDateTime > existingStart;
    });

    if (hasConflict) {
      return next(new Error("This time slot conflicts with another event in this venue space."));
    }
  }
  next();
});

// ======================================================
// 3. MIDDLEWARE: Price Calculations
// ======================================================
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

    // Recalculate totals if not explicitly set correctly
    // Note: In your frontend you calculate tax, we should ideally store taxRate 
    // and let backend verify, but for now we trust the totalAmount
    this.pricing.totalAmount = Math.max(0, total);
    this.paymentSummary.totalAmount = this.pricing.totalAmount;
  }
  next();
});

// ======================================================
// 4. METHODS
// ======================================================

eventSchema.statics.archiveEvent = async function(eventId, archivedBy) {
  return await this.findByIdAndUpdate(
    eventId,
    {
      isArchived: true,
      archivedAt: new Date(),
      archivedBy: archivedBy
    },
    { new: true }
  );
};

eventSchema.statics.restoreEvent = async function(eventId) {
  return await this.findByIdAndUpdate(
    eventId,
    {
      isArchived: false,
      archivedAt: null,
      archivedBy: null
    },
    { new: true }
  );
};

eventSchema.statics.checkAvailability = async function(venueSpaceId, startDate, startTime, endDate, endTime, excludeEventId = null) {
  const startDateTime = createDateTime(startDate, startTime);
  const endDateTime = createDateTime(endDate, endTime);

  const query = {
    venueSpaceId: venueSpaceId,
    status: { $ne: "cancelled" },
    isArchived: { $ne: true },
    $or: [
      { startDate: { $lte: endDate }, endDate: { $gte: startDate } }
    ]
  };

  if (excludeEventId) {
    query._id = { $ne: excludeEventId };
  }

  const potentialConflicts = await this.find(query);

  const isConflict = potentialConflicts.some(existing => {
    const existingStart = createDateTime(existing.startDate, existing.startTime);
    const existingEnd = createDateTime(existing.endDate, existing.endTime);
    return startDateTime < existingEnd && endDateTime > existingStart;
  });

  return !isConflict;
};

// Indexes for Performance
eventSchema.index({ startDate: 1, endDate: 1 });
eventSchema.index({ venueSpaceId: 1, startDate: 1 }); // Critical for collision check
eventSchema.index({ venueId: 1, status: 1 });
eventSchema.index({ clientId: 1 });

export default mongoose.model("Event", eventSchema);