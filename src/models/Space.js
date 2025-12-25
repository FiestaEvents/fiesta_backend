import mongoose from "mongoose";

const spaceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Resource name is required"], // e.g., "Grand Ballroom" or "Mercedes S-Class"
      trim: true,
    },
    
    // Resource Type (Polymorphic)
    // Allows this model to serve Venues (rooms), Drivers (vehicles), and Tech (equipment)
    type: {
      type: String,
      enum: ["room", "vehicle", "equipment", "table"],
      default: "room",
      required: true
    },

    description: {
      type: String,
      required: [true, "Description is required"],
    },
    
    // Capacity: People for Rooms, Passengers for Vehicles
    capacity: {
      min: { type: Number, required: true, min: 1 },
      max: { type: Number, required: true, min: 1 },
    },
    
    basePrice: { type: Number, required: true, min: 0 },
    
    // Setup/Teardown buffer time (in minutes)
    // Used for collision detection (Cleaning a room OR Cleaning a vehicle)
    turnoverTime: { type: Number, default: 60 }, 

    amenities: [String], // e.g., ["Projector", "AC"] or ["Wifi", "Leather Seats"]
    images: [String],
    
    // Resource-specific availability overrides generic Business hours
    operatingHours: {
      monday: { open: String, close: String, closed: { type: Boolean, default: false } },
      tuesday: { open: String, close: String, closed: { type: Boolean, default: false } },
      wednesday: { open: String, close: String, closed: { type: Boolean, default: false } },
      thursday: { open: String, close: String, closed: { type: Boolean, default: false } },
      friday: { open: String, close: String, closed: { type: Boolean, default: false } },
      saturday: { open: String, close: String, closed: { type: Boolean, default: false } },
      sunday: { open: String, close: String, closed: { type: Boolean, default: false } },
    },
    
    // =========================================================
    // ARCHITECTURE UPDATE: Replaces venueId
    // =========================================================
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    
    isReserved: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    isArchived: { type: Boolean, default: false },
    timeZone: { type: String, required: true, default: "Africa/Tunis" },
  },
  {
    timestamps: true,
  }
);

// Cascade delete related events when a Resource is deleted
spaceSchema.pre("deleteOne", { document: true }, async function (next) {
  const resourceId = this._id;

  // Import Event model dynamically to avoid circular dependency issues
  const Event = mongoose.model("Event");
  
  // Use 'resourceId' (the new field name in Event.js) instead of 'venueSpaceId'
  await Event.deleteMany({ resourceId: resourceId }); 

  next();
});

// Index for efficient scheduling lookups
spaceSchema.index({ businessId: 1, type: 1 });

export default mongoose.model("Space", spaceSchema);