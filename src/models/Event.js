import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    // --- Core Info ---
    title: { type: String, required: true, trim: true, maxlength: 200 },
    type: {
      type: String,
      enum: ["wedding", "birthday", "corporate", "conference", "party", "other"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "in-progress", "completed", "cancelled"],
      default: "pending",
    },
    notes: { type: String, maxlength: 2000 },
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
    
    // --- Relations ---
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true },
    venueId: { type: mongoose.Schema.Types.ObjectId, ref: "Venue", required: true },
    venueSpaceId: { type: mongoose.Schema.Types.ObjectId, ref: "VenueSpace", required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    // ✅ ADD THIS: Partners Array
    partners: [
      {
        partner: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Partner",
        },
        service: String,
        cost: { type: Number, default: 0, min: 0 },
        hours: { type: Number, default: 0, min: 0 },
        status: {
          type: String,
          enum: ["pending", "confirmed", "cancelled"],
          default: "pending",
        },
      },
    ],

    // --- Scheduling ---
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    startTime: { type: String, required: true }, // Format "HH:mm"
    endTime: { type: String, required: true },   // Format "HH:mm"
    guestCount: { type: Number, min: 1 },

    // --- Financials (Requested Updates) ---
    pricing: {
      basePrice: { type: Number, default: 0, min: 0 },
      additionalServices: [
        {
          name: String,
          price: { type: Number, default: 0 },
        },
      ],
      discount: { type: Number, default: 0, min: 0 },
      taxRate: { type: Number, default: 19 }, // Percentage (e.g., 19 for 19%)
      
      // New Fields
      totalPriceBeforeTax: { type: Number, default: 0 },
      totalPriceAfterTax: { type: Number, default: 0 },
    },

    // Simplified Payment Tracking
    paymentInfo: {
      paidAmount: { type: Number, default: 0 },
      status: {
        type: String,
        enum: ["unpaid", "partial", "paid", "overdue"],
        default: "unpaid",
      },
      transactions: [{ type: mongoose.Schema.Types.ObjectId, ref: "Payment" }],
    },

    // --- Meta ---
    isArchived: { type: Boolean, default: false },
    archivedAt: Date,
  },
  { timestamps: true }
);

// ======================================================
// 1. HELPER: Date/Time Merger
// ======================================================
const createDateTime = (date, timeStr) => {
  if (!date || !timeStr) return null;
  const d = new Date(date);
  const [hours, minutes] = timeStr.split(":");
  d.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  return d;
};

// ======================================================
// 2. MIDDLEWARE: Automatic Price Calculation
// ======================================================
eventSchema.pre("save", function (next) {
  if (this.pricing) {
    // 1. Calculate Services Total
    const servicesTotal = (this.pricing.additionalServices || []).reduce(
      (sum, item) => sum + (item.price || 0),
      0
    );

    // 2. Calculate Total Before Tax (Base + Services - Discount)
    const subtotal = (this.pricing.basePrice || 0) + servicesTotal;
    const beforeTax = Math.max(0, subtotal - (this.pricing.discount || 0));

    // 3. Calculate Tax Amount
    const taxAmount = beforeTax * ((this.pricing.taxRate || 0) / 100);

    // 4. Set Final Values
    this.pricing.totalPriceBeforeTax = Number(beforeTax.toFixed(2));
    this.pricing.totalPriceAfterTax = Number((beforeTax + taxAmount).toFixed(2));
    
    // Auto-update payment status
    if (this.paymentInfo.paidAmount >= this.pricing.totalPriceAfterTax && this.pricing.totalPriceAfterTax > 0) {
      this.paymentInfo.status = "paid";
    } else if (this.paymentInfo.paidAmount > 0) {
      this.paymentInfo.status = "partial";
    }
  }
  next();
});

// ======================================================
// 3. MIDDLEWARE: Collision Detection
// ======================================================
eventSchema.pre("save", async function (next) {
  if (
    !this.isModified("venueSpaceId") &&
    !this.isModified("startDate") &&
    !this.isModified("endDate") &&
    !this.isModified("startTime") &&
    !this.isModified("endTime")
  ) {
    return next();
  }

  const start = createDateTime(this.startDate, this.startTime);
  const end = createDateTime(this.endDate, this.endTime);

  if (end <= start) return next(new Error("End time must be after start time"));

  const Event = mongoose.model("Event");
  const conflict = await Event.findOne({
    venueSpaceId: this.venueSpaceId,
    _id: { $ne: this._id },
    status: { $ne: "cancelled" },
    isArchived: false,
    $or: [{ startDate: { $lte: this.endDate }, endDate: { $gte: this.startDate } }],
  });

  if (conflict) {
    const existingStart = createDateTime(conflict.startDate, conflict.startTime);
    const existingEnd = createDateTime(conflict.endDate, conflict.endTime);
    
    // Check for actual overlap
    if (start < existingEnd && end > existingStart) {
      return next(new Error("Time slot conflict detected for this venue space."));
    }
  }
  next();
});

// Indexes
eventSchema.index({ venueSpaceId: 1, startDate: 1, endDate: 1 });
eventSchema.index({ clientId: 1 });

export default mongoose.model("Event", eventSchema);