import mongoose from "mongoose"

const venueSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Venue name is required"],
      trim: true,
      maxlength: [200, "Name cannot exceed 200 characters"],
    },
    description: {
      type: String,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
    address: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      zipCode: String,
      country: { type: String, default: "Tunisia" },
    },
    contact: {
      phone: { type: String, required: true },
      email: { type: String, required: true },
      website: String,
    },
    capacity: {
      min: { type: Number, required: true, min: 1 },
      max: { type: Number, required: true, min: 1 },
    },
    amenities: [
      {
        type: String,
        enum: ["parking", "wifi", "ac", "sound-system", "projector", "kitchen", "bar", "garden", "pool", "other"],
      },
    ],
    pricing: {
      basePrice: { type: Number, required: true, min: 0 },
      pricePerGuest: { type: Number, default: 0, min: 0 },
      cleaningFee: { type: Number, default: 0, min: 0 },
      securityDeposit: { type: Number, default: 0, min: 0 },
    },
    availability: {
      daysOfWeek: [Number], // 0-6, Sunday to Saturday
      timeSlots: [
        {
          start: String,
          end: String,
        },
      ],
      blackoutDates: [Date],
    },
    images: [
      {
        url: String,
        caption: String,
        isPrimary: { type: Boolean, default: false },
      },
    ],
    settings: {
      timezone: { type: String, default: "Africa/Tunis" },
      currency: { type: String, default: "TND" },
      language: { type: String, default: "fr" },
      bookingAdvanceNotice: { type: Number, default: 24 }, // hours
      cancellationPolicy: String,
    },
    subscription: {
      plan: {
        type: String,
        enum: ["monthly", "annual", "lifetime"],
        required: true,
      },
      status: {
        type: String,
        enum: ["active", "expired", "cancelled"],
        default: "active",
      },
      startDate: { type: Date, required: true },
      endDate: Date,
      amount: { type: Number, required: true },
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
)

// Validate capacity
venueSchema.pre("save", function (next) {
  if (this.capacity.max < this.capacity.min) {
    next(new Error("Maximum capacity must be greater than or equal to minimum capacity"))
  }
  next()
})

export default mongoose.model("Venue", venueSchema)
