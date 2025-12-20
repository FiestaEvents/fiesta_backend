import mongoose from "mongoose";

const venueSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Venue name is required"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Description is required"],
    },
    address: {
      street: { type: String },
      city: { type: String, required: true },
      state: { type: String },
      zipCode: { type: String },
      country: { type: String },
    },
    contact: {
      phone: { type: String, required: true },
      email: {
        type: String,
        required: true,
        match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
      },
    },
    capacity: {
      min: { type: Number, required: true, min: 1 },
      max: { type: Number, required: true, min: 1 },
    },
    pricing: {
      basePrice: { type: Number, required: true, min: 0 },
    },
    amenities: [String],
    images: [String],
    operatingHours: {
      monday: {
        open: String,
        close: String,
        closed: { type: Boolean, default: false },
      },
      tuesday: {
        open: String,
        close: String,
        closed: { type: Boolean, default: false },
      },
      wednesday: {
        open: String,
        close: String,
        closed: { type: Boolean, default: false },
      },
      thursday: {
        open: String,
        close: String,
        closed: { type: Boolean, default: false },
      },
      friday: {
        open: String,
        close: String,
        closed: { type: Boolean, default: false },
      },
      saturday: {
        open: String,
        close: String,
        closed: { type: Boolean, default: false },
      },
      sunday: {
        open: String,
        close: String,
        closed: { type: Boolean, default: false },
      },
    },
    subscription: {
      plan: {
        type: String,
        enum: ["free", "monthly", "annual", "lifetime", "custom"],
        required: true,
      },
      status: {
        type: String,
        enum: ["active", "inactive", "pending", "cancelled"],
        required: true,
      },
      startDate: { type: Date, required: true },
      endDate: { type: Date },
      amount: { type: Number, required: true },
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    isActive: { type: Boolean, default: true },
    timeZone: { type: String, required: true, default: "UTC" },
    
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
  },
  {
    timestamps: true,
  }
);

// Update the cascade delete to archive instead of delete
venueSchema.pre("deleteOne", { document: true }, async function (next) {
  // Instead of deleting, we'll archive the venue
  this.isArchived = true;
  this.archivedAt = new Date();
  this.archivedBy = this.owner; // or req.user._id from context
  
  // Prevent the actual deletion
  next(new Error("Venues should be archived instead of deleted. Use archiveVenue method."));
});

// Static method to archive a venue
venueSchema.statics.archiveVenue = async function(venueId, archivedBy) {
  return await this.findByIdAndUpdate(
    venueId,
    {
      isArchived: true,
      archivedAt: new Date(),
      archivedBy: archivedBy,
      isActive: false
    },
    { new: true }
  );
};

// Static method to restore a venue
venueSchema.statics.restoreVenue = async function(venueId) {
  return await this.findByIdAndUpdate(
    venueId,
    {
      isArchived: false,
      archivedAt: null,
      archivedBy: null,
      isActive: true
    },
    { new: true }
  );
};

// Query helper to exclude archived venues by default
venueSchema.query.excludeArchived = function() {
  return this.where({ isArchived: { $ne: true } });
};

venueSchema.query.includeArchived = function() {
  return this;
};

export default mongoose.model("Venue", venueSchema);