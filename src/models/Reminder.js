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
    
    // Fixed: Properly indented archive fields
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
      required: [true, "Reminder time is required"],
    },
    isRecurring: {
      type: Boolean,
      default: false,
    },
    recurrence: {
      frequency: {
        type: String,
        enum: ["daily", "weekly", "monthly", "yearly"],
        required: function () {
          return this.isRecurring;
        },
      },
      interval: {
        type: Number,
        default: 1,
        min: [1, "Interval must be at least 1"],
      },
      endDate: Date,
      daysOfWeek: [Number],
      dayOfMonth: Number,
    },
    status: {
      type: String,
      enum: ["active", "completed", "snoozed", "cancelled"],
      default: "active",
    },
    snoozeUntil: {
      type: Date,
    },
    notificationMethods: [
      {
        type: String,
        enum: ["email", "sms", "push", "in_app"],
      },
    ],
    relatedEvent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
    },
    relatedClient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
    },
    relatedTask: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
    },
    relatedPayment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
    },
    assignedTo: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    completedAt: {
      type: Date,
    },
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    notes: {
      type: String,
      maxlength: [500, "Notes cannot exceed 500 characters"],
    },
    venueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Venue",
      required: true,
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

// Add static methods for archive functionality
reminderSchema.statics.archiveReminder = async function(reminderId, archivedBy) {
  return await this.findByIdAndUpdate(
    reminderId,
    {
      isArchived: true,
      archivedAt: new Date(),
      archivedBy: archivedBy
    },
    { new: true }
  );
};

reminderSchema.statics.restoreReminder = async function(reminderId) {
  return await this.findByIdAndUpdate(
    reminderId,
    {
      isArchived: false,
      archivedAt: null,
      archivedBy: null
    },
    { new: true }
  );
};

// Query helpers
reminderSchema.query.excludeArchived = function() {
  return this.where({ isArchived: { $ne: true } });
};

reminderSchema.query.includeArchived = function() {
  return this;
};

reminderSchema.index({ venueId: 1, reminderDate: 1, status: 1 });
reminderSchema.index({ assignedTo: 1, status: 1 });
reminderSchema.index({ isArchived: 1 });

export default mongoose.model("Reminder", reminderSchema);