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
    venueId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Venue", 
      required: true,
    },
    status: { 
      type: String, 
      enum: ["active", "inactive"], 
      default: "active",
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
    tags: [String],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Removed eventHistory - query events by clientId instead
clientSchema.index({ venueId: 1, status: 1 });
clientSchema.index({ email: 1, venueId: 1 });

export default mongoose.model("Client", clientSchema);