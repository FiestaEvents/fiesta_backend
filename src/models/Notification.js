import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["reminder", "system", "message", "alert"],
      default: "system",
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    data: {
      // Flexible payload (e.g., link to the Reminder ID)
      entityId: mongoose.Schema.Types.ObjectId,
      entityType: String, // 'Reminder', 'Event', etc.
      link: String,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: Date,
  },
  {
    timestamps: true,
    expires: 60 * 60 * 24 * 30, // Optional: Auto-delete after 30 days
  }
);

export default mongoose.model("Notification", notificationSchema);