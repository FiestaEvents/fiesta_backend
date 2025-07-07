import mongoose from "mongoose"

const partnerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Partner name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    company: {
      type: String,
      required: [true, "Company name is required"],
      trim: true,
      maxlength: [100, "Company name cannot exceed 100 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, "Please enter a valid email"],
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      enum: ["catering", "decoration", "photography", "music", "security", "cleaning", "other"],
    },
    specialties: [
      {
        type: String,
        trim: true,
      },
    ],
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: 5,
    },
    priceRange: {
      min: { type: Number, default: 0 },
      max: { type: Number, default: 0 },
    },
    availability: {
      type: String,
      enum: ["available", "busy", "unavailable"],
      default: "available",
    },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: { type: String, default: "Tunisia" },
    },
    website: {
      type: String,
      trim: true,
    },
    socialMedia: {
      facebook: String,
      instagram: String,
      linkedin: String,
    },
    contractDetails: {
      contractType: {
        type: String,
        enum: ["per-event", "monthly", "annual"],
        default: "per-event",
      },
      paymentTerms: String,
      notes: String,
    },
    eventHistory: [
      {
        eventId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Event",
        },
        eventDate: Date,
        service: String,
        amount: Number,
        rating: Number,
      },
    ],
    totalEarnings: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
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

// Index for search functionality
partnerSchema.index({ name: "text", company: "text", category: 1 })

export default mongoose.model("Partner", partnerSchema)
