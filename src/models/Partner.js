import mongoose from "mongoose";

const partnerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Partner name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
    },
    phone: {
      type: String,
      required: [true, "Phone is required"],
      trim: true,
    },
    venueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Venue",
      required: true,
    },
    category: {
      type: String,
      enum: [
        "driver",
        "bakery",
        "catering",
        "decoration",
        "photography",
        "music",
        "security",
        "cleaning",
        "audio_visual",
        "floral",
        "entertainment",
        "hairstyling",
        "other",
      ],
      required: [true, "Category is required"],
    },
    company: { type: String },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  isArchived: { type: Boolean, default: false },
  archivedAt: { type: Date },
  archivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
    location: { type: String },
    specialties: { type: String },
    hourlyRate: { type: Number, min: 0 },
    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
    },
    totalJobs: {
      type: Number,
      default: 0,
    },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
    },
    notes: {
      type: String,
      maxlength: [1000, "Notes cannot exceed 1000 characters"],
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

partnerSchema.index({ venueId: 1, category: 1, status: 1 });

export default mongoose.model("Partner", partnerSchema);
