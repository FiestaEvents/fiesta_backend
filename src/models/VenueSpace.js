import mongoose from "mongoose";

const venueSpaceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Venue space name is required"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Description is required"],
    },
    capacity: {
      min: { type: Number, required: true, min: 1 },
      max: { type: Number, required: true, min: 1 },
    },
    basePrice: { type: Number, required: true, min: 0 },
    
    // ✅ NEW: Setup/Teardown buffer time (in minutes)
    // This helps collision detection know if a room needs cleaning between events
    turnoverTime: { type: Number, default: 60 }, 

    amenities: [String],
    images: [String],
    operatingHours: {
      monday: { open: String, close: String, closed: { type: Boolean, default: false } },
      tuesday: { open: String, close: String, closed: { type: Boolean, default: false } },
      wednesday: { open: String, close: String, closed: { type: Boolean, default: false } },
      thursday: { open: String, close: String, closed: { type: Boolean, default: false } },
      friday: { open: String, close: String, closed: { type: Boolean, default: false } },
      saturday: { open: String, close: String, closed: { type: Boolean, default: false } },
      sunday: { open: String, close: String, closed: { type: Boolean, default: false } },
    },
    venueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Venue",
      required: true,
      index: true, // Added index for faster lookups
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    isReserved: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    isArchived: { type: Boolean, default: false },
    timeZone: { type: String, required: true, default: "Africa/Tunis" }, // Updated default
  },
  {
    timestamps: true,
  }
);

// ✅ FIXED: Cascade delete related documents
venueSpaceSchema.pre("deleteOne", { document: true }, async function (next) {
  const spaceId = this._id; // This is the Space ID, not Venue ID

  // Import models
  const Event = mongoose.model("Event");
  await Event.deleteMany({ venueSpaceId: spaceId }); 

  next();
});

export default mongoose.model("VenueSpace", venueSpaceSchema);