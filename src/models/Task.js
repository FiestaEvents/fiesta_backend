// src/models/Task.js
const mongoose = require('mongoose');

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
        "maintenance",        // Venues (Repairs) & Drivers (Vehicle Check)
        "client_followup",
        "partner_coordination",
        "administrative",
        "finance",
        "setup",              // DJs, Decorators
        "cleanup",
        "post_production",    // NEW: Photographers/Videographers (Editing)
        "delivery",           // NEW: Caterers, Drivers
        "inventory_check",    // NEW: General stock check
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
    
    // =========================================================
    // ARCHITECTURE UPDATE: Replaces venueId
    // =========================================================
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
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

// Search Index
taskSchema.index({ title: "text", description: "text" });

// Compound index for efficiently fetching a Business's tasks
taskSchema.index({ businessId: 1, status: 1, dueDate: 1 });

module.exports = mongoose.model("Task", taskSchema);