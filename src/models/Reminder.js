import mongoose from "mongoose";

const reminderSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Reminder title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    description: {
      type: String,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
    type: {
      type: String,
      enum: ["event", "payment", "task", "maintenance", "followup", "other"],
      default: "other",
    },
    // Simplified status: Active or Completed. (Archived handles 'deleted')
    status: {
      type: String,
      enum: ["active", "completed"],
      default: "active",
    },
    // Priority is optional/visual only now
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    reminderDate: {
      type: Date,
      required: [true, "Reminder date is required"],
    },
    reminderTime: {
      type: String,
      required: [true, "Reminder time is required"], // Format: "HH:mm"
    },

    // Archive / Soft Delete Logic
    isArchived: {
      type: Boolean,
      default: false,
    },
    archivedAt: {
      type: Date,
    },

    // Relationships
    venueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Venue",
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    assignedTo: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
     dismissed: {
    type: Boolean,
    default: false,
  },
  dismissedAt: {
    type: Date,
  },
  dismissedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  snoozeHistory: [
    {
      snoozedAt: { type: Date, default: Date.now },
      snoozeMinutes: Number,
      snoozedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    },
  ],

    // Optional Relations
    relatedEvent: { type: mongoose.Schema.Types.ObjectId, ref: "Event" },
    relatedClient: { type: mongoose.Schema.Types.ObjectId, ref: "Client" },
    relatedTask: { type: mongoose.Schema.Types.ObjectId, ref: "Task" },
    relatedPayment: { type: mongoose.Schema.Types.ObjectId, ref: "Payment" },
  },
  {
    timestamps: true,
  }
);

// Indexes for common queries
reminderSchema.index({  venueId: 1, 
  isArchived: 1, 
  status: 1,
  reminderDate: 1 
 });
reminderSchema.index({  reminderDate: 1, 
  reminderTime: 1  });
reminderSchema.index({ 
  title: 'text', 
  description: 'text' 
});
export default mongoose.model("Reminder", reminderSchema);
