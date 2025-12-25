import mongoose from "mongoose";

const activityLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // ✅ Renamed to businessId
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
    },
    action: {
      type: String,
      required: true, // e.g., "create_event", "update_settings"
    },
    details: {
      type: String,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true, // Adds createdAt/updatedAt automatically
  }
);

// Indexes for performance
activityLogSchema.index({ businessId: 1, timestamp: -1 });
activityLogSchema.index({ userId: 1, timestamp: -1 });

export default mongoose.model("ActivityLog", activityLogSchema);