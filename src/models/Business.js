import mongoose from "mongoose";

const businessSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Business name is required"],
      trim: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    category: {
      type: String,
      required: [true, "Business category is required"],
      enum: [
        "venue",
        "photography",
        "videography",
        "catering",
        "bakery",
        "florist",
        "decoration",
        "music",
        "entertainment",
        "driver",
        "security",
        "planning",
        "makeup",
        "hair",
        "attire",
        "other",
      ],
      default: "venue",
    },
    description: {
      type: String,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
      coordinates: {
        lat: Number,
        lng: Number,
      },
    },
    contact: {
      email: String,
      phone: String,
      website: String,
    },
    images: [
      {
        url: String,
        publicId: String,
        caption: String,
      },
    ],
    operatingHours: {
      monday: { open: String, close: String, closed: Boolean },
      tuesday: { open: String, close: String, closed: Boolean },
      wednesday: { open: String, close: String, closed: Boolean },
      thursday: { open: String, close: String, closed: Boolean },
      friday: { open: String, close: String, closed: Boolean },
      saturday: { open: String, close: String, closed: Boolean },
      sunday: { open: String, close: String, closed: Boolean },
    },

    subscription: {
      plan: {
        type: String,
        enum: ["free", "starter", "pro", "enterprise"],
        default: "free",
      },
      status: {
        type: String,
        enum: ["active", "past_due", "cancelled", "trial"],
        default: "active",
      },
      startDate: Date,
      endDate: Date,
      stripeCustomerId: String,
    },

    settings: {
      currency: { type: String, default: "TND" },
      taxId: String,
      taxRate: { type: Number, default: 19 },
      dateFormat: { type: String, default: "DD/MM/YYYY" },
      timeZone: { type: String, default: "Africa/Tunis" },
    },

    // ✅ FIX: REMOVED DEFAULTS to prevent auto-population of irrelevant fields
    venueDetails: {
      capacity: {
        min: { type: Number }, // No default: 0
        max: { type: Number }, // No default: 0
      },
      amenities: [String],
    },

    // ✅ FIX: REMOVED DEFAULTS to prevent auto-population of irrelevant fields
    serviceDetails: {
      serviceRadiusKM: { type: Number }, // No default: 50
      pricingModel: {
        type: String,
        enum: ["fixed", "hourly", "daily", "package", "custom"],
        // No default
      },
      travelFee: { type: Number },
      portfolio: [
        {
          title: String,
          url: String,
          tags: [String],
        },
      ],
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Business", businessSchema);
