import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Task title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
      index: "text",
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, "Description cannot exceed 2000 characters"],
    },
    status: {
      type: String,
      enum: ["pending", "todo", "in_progress", "completed", "cancelled", "blocked"],
      default: "todo",
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
      index: true,
    },
    category: {
      type: String,
      enum: [
        "event_preparation",
        "marketing",
        "maintenance",
        "client_followup",
        "partner_coordination",
        "administrative",
        "finance",
        "setup",
        "cleanup",
        "other",
      ],
      default: "other",
      index: true,
    },
    dueDate: {
      type: Date,
      index: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    subtasks: [
      {
        title: {
          type: String,
          required: true,
          trim: true,
        },
        completed: {
          type: Boolean,
          default: false,
        },
      },
    ],
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
    // Essential for Tenancy & Audit
    venueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Venue",
      required: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true, // Automatically manages createdAt and updatedAt
  }
);

// Basic Search Index
taskSchema.index({ title: "text", description: "text" });

export default mongoose.model("Task", taskSchema);