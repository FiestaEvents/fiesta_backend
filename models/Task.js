import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Task title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    description: {
      type: String,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    status: {
      type: String,
      enum: ["todo", "in-progress", "completed", "cancelled"],
      default: "todo",
    },
    category: {
      type: String,
      enum: [
        "event-preparation",
        "maintenance",
        "client-follow-up",
        "partner-coordination",
        "administrative",
        "other",
      ],
      default: "other",
    },
    dueDate: {
      type: Date,
      required: [true, "Due date is required"],
    },
    estimatedHours: {
      type: Number,
      min: [0, "Estimated hours cannot be negative"],
    },
    actualHours: {
      type: Number,
      min: [0, "Actual hours cannot be negative"],
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    relatedEvent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
    },
    relatedClient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
    },
    relatedPartner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Partner",
    },
    subtasks: [
      {
        title: {
          type: String,
          required: true,
          maxlength: [200, "Subtask title cannot exceed 200 characters"],
        },
        completed: {
          type: Boolean,
          default: false,
        },
        completedAt: Date,
        completedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],
    attachments: [
      {
        fileName: String,
        fileUrl: String,
        uploadDate: { type: Date, default: Date.now },
        uploadedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],
    comments: [
      {
        text: {
          type: String,
          required: true,
          maxlength: [500, "Comment cannot exceed 500 characters"],
        },
        author: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    completedAt: {
      type: Date,
    },
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    venueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Venue",
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Update completedAt when status changes to completed
taskSchema.pre("save", function (next) {
  if (
    this.isModified("status") &&
    this.status === "completed" &&
    !this.completedAt
  ) {
    this.completedAt = new Date();
  }
  next();
});

// Index for task queries
taskSchema.index({ venueId: 1, status: 1, dueDate: 1 });
taskSchema.index({ assignedTo: 1, status: 1 });

export default mongoose.model("Task", taskSchema);
