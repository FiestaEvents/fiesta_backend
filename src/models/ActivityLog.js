import mongoose from "mongoose";

const activityLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  action: {
    type: String,
    required: true, // e.g., "created_event", "updated_client", "logged_in"
  },
  details: {
    type: String, // e.g., "Created event: Annual Gala"
  },
  metadata: {
    type: Object, // Optional: store IDs of changed objects { eventId: "..." }
  },
  venueId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Venue",
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model("ActivityLog", activityLogSchema);