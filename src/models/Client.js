import mongoose from "mongoose";

const clientSchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: [true, "Client name is required"],
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
    
    // =========================================================
    // ARCHITECTURE UPDATE: Replaces venueId
    // =========================================================
    businessId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Business", 
      required: true,
    },
    
    status: { 
      type: String, 
      enum: ["active", "inactive"], 
      default: "active",
    },
    
    // Archive fields (Soft Delete)
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
    
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
    },
    company: String,
    notes: {
      type: String,
      maxlength: [1000, "Notes cannot exceed 1000 characters"],
    },
    tags: [String], // e.g., "VIP", "Wedding 2024", "Corporate"
    
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Prevent accidental hard deletes on the document instance
clientSchema.pre("deleteOne", { document: true }, async function (next) {
  const error = new Error("Clients should be archived instead of deleted. Use the archive functionality.");
  next(error);
});

// Static method to archive a client
clientSchema.statics.archiveClient = async function(clientId, archivedBy) {
  return await this.findByIdAndUpdate(
    clientId,
    {
      isArchived: true,
      archivedAt: new Date(),
      archivedBy: archivedBy,
      status: "inactive"
    },
    { new: true }
  );
};

// Static method to restore a client
clientSchema.statics.restoreClient = async function(clientId) {
  return await this.findByIdAndUpdate(
    clientId,
    {
      isArchived: false,
      archivedAt: null,
      archivedBy: null,
      status: "active"
    },
    { new: true }
  );
};

// Query helper to exclude archived clients by default
clientSchema.query.excludeArchived = function() {
  return this.where({ isArchived: { $ne: true } });
};

clientSchema.query.includeArchived = function() {
  return this;
};

// Updated Indexes for the new Business Architecture
clientSchema.index({ businessId: 1, status: 1 });
// Ensures email uniqueness is scoped PER BUSINESS (A client can exist in multiple businesses)
clientSchema.index({ email: 1, businessId: 1 }, { unique: true });
clientSchema.index({ isArchived: 1 });

// ✅ FIXED: Using ES Module syntax
export default mongoose.model("Client", clientSchema);