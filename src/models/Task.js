import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Task title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
      index: "text", // Enable text search on title
    },
    description: {
      type: String,
      maxlength: [2000, "Description cannot exceed 2000 characters"],
      index: "text", // Enable text search on description
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "todo", "in_progress", "completed", "cancelled", "blocked"],
      default: "pending",
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
      required: [true, "Due date is required"],
      index: true,
    },
    startDate: {
      type: Date,
      validate: {
        validator: function (value) {
          if (!value || !this.dueDate) return true;
          return value <= this.dueDate;
        },
        message: "Start date must be before or equal to due date",
      },
    },
    reminderDate: {
      type: Date,
      validate: {
        validator: function (value) {
          if (!value || !this.dueDate) return true;
          return value <= this.dueDate;
        },
        message: "Reminder date must be before or equal to due date",
      },
    },
    estimatedHours: {
      type: Number,
      min: [0, "Estimated hours cannot be negative"],
      max: [1000, "Estimated hours seems unrealistic"],
    },
    actualHours: {
      type: Number,
      min: [0, "Actual hours cannot be negative"],
      max: [1000, "Actual hours seems unrealistic"],
    },
    progress: {
      type: Number,
      min: [0, "Progress cannot be less than 0%"],
      max: [100, "Progress cannot exceed 100%"],
      default: 0,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    assignedAt: {
      type: Date,
    },
    watchers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    relatedEvent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      index: true,
    },
    relatedClient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      index: true,
    },
    relatedPartner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Partner",
      index: true,
    },
    dependencies: [
      {
        task: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Task",
        },
        type: {
          type: String,
          enum: ["blocks", "blocked_by", "relates_to"],
          default: "relates_to",
        },
      },
    ],
    blockedReason: {
      type: String,
      maxlength: [500, "Blocked reason cannot exceed 500 characters"],
      required: function () {
        return this.status === "blocked";
      },
    },
    subtasks: [
      {
        title: {
          type: String,
          required: [true, "Subtask title is required"],
          trim: true,
          maxlength: [200, "Subtask title cannot exceed 200 characters"],
        },
        description: {
          type: String,
          maxlength: [500, "Subtask description cannot exceed 500 characters"],
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
        order: {
          type: Number,
          default: 0,
        },
      },
    ],
    attachments: [
      {
        fileName: {
          type: String,
          required: true,
        },
        fileUrl: {
          type: String,
          required: true,
        },
        fileSize: Number,
        fileType: String,
        uploadDate: {
          type: Date,
          default: Date.now,
        },
        uploadedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
      },
    ],
    comments: [
      {
        text: {
          type: String,
          required: [true, "Comment text is required"],
          trim: true,
          maxlength: [1000, "Comment cannot exceed 1000 characters"],
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
        editedAt: Date,
        isEdited: {
          type: Boolean,
          default: false,
        },
        mentions: [
          {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
          },
        ],
      },
    ],
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
    recurrence: {
      enabled: {
        type: Boolean,
        default: false,
      },
      frequency: {
        type: String,
        enum: ["daily", "weekly", "monthly", "yearly"],
      },
      interval: {
        type: Number,
        min: 1,
        default: 1,
      },
      endDate: Date,
      lastOccurrence: Date,
    },
    completedAt: Date,
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    cancelledAt: Date,
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    cancellationReason: {
      type: String,
      maxlength: [500, "Cancellation reason cannot exceed 500 characters"],
    },
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
  isArchived: { type: Boolean, default: false },
  archivedAt: { type: Date },
  archivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
    metadata: {
      viewCount: {
        type: Number,
        default: 0,
      },
      lastViewedAt: Date,
      lastViewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    },
  },
  {
    timestamps: true,
  }
);

// ============================================
// INDEXES
// ============================================
taskSchema.index({ venueId: 1, status: 1, dueDate: 1 });
taskSchema.index({ assignedTo: 1, status: 1, dueDate: 1 });
taskSchema.index({ venueId: 1, category: 1, priority: 1 });
taskSchema.index({ relatedEvent: 1, status: 1 });
taskSchema.index({ createdBy: 1, status: 1 });
taskSchema.index({ tags: 1 });
taskSchema.index({ isArchived: 1, venueId: 1 });
taskSchema.index({ title: "text", description: "text" }); // Full text search

// ============================================
// VIRTUAL FIELDS
// ============================================
taskSchema.virtual("isOverdue").get(function () {
  return (
    this.status !== "completed" &&
    this.status !== "cancelled" &&
    this.dueDate < new Date()
  );
});

taskSchema.virtual("isDueToday").get(function () {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return this.dueDate >= today && this.dueDate < tomorrow;
});

taskSchema.virtual("isDueSoon").get(function () {
  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
  return (
    this.dueDate <= threeDaysFromNow &&
    this.status !== "completed" &&
    this.status !== "cancelled"
  );
});

taskSchema.virtual("completionPercentage").get(function () {
  if (this.status === "completed") return 100;
  if (this.status === "cancelled") return 0;
  if (!this.subtasks || this.subtasks.length === 0) return this.progress || 0;

  const completedSubtasks = this.subtasks.filter((st) => st.completed).length;
  return Math.round((completedSubtasks / this.subtasks.length) * 100);
});

taskSchema.virtual("timeSpent").get(function () {
  return this.actualHours || 0;
});

taskSchema.virtual("timeRemaining").get(function () {
  if (!this.estimatedHours || !this.actualHours) return null;
  return Math.max(0, this.estimatedHours - this.actualHours);
});

// ============================================
// PRE-SAVE MIDDLEWARE
// ============================================

// Auto-update completedAt when status changes to completed
taskSchema.pre("save", function (next) {
  if (this.isModified("status")) {
    if (this.status === "completed" && !this.completedAt) {
      this.completedAt = new Date();
      this.progress = 100;
    } else if (this.status === "cancelled" && !this.cancelledAt) {
      this.cancelledAt = new Date();
    }
  }
  next();
});

// Auto-update progress based on subtasks
taskSchema.pre("save", function (next) {
  if (this.subtasks && this.subtasks.length > 0 && !this.isModified("progress")) {
    const completedCount = this.subtasks.filter((st) => st.completed).length;
    this.progress = Math.round((completedCount / this.subtasks.length) * 100);

    // Auto-complete task if all subtasks are done
    if (
      completedCount === this.subtasks.length &&
      this.status !== "completed" &&
      this.status !== "cancelled"
    ) {
      this.status = "completed";
      this.completedAt = new Date();
    }
  }
  next();
});

// Track assignment changes
taskSchema.pre("save", function (next) {
  if (this.isModified("assignedTo") && this.assignedTo) {
    this.assignedAt = new Date();
  }
  next();
});

// Validate blocked status
taskSchema.pre("save", function (next) {
  if (this.status === "blocked" && !this.blockedReason) {
    return next(new Error("Blocked reason is required when status is blocked"));
  }
  next();
});

// ============================================
// INSTANCE METHODS
// ============================================

/**
 * Check if user is authorized to modify task
 */
taskSchema.methods.canModify = function (userId) {
  return (
    this.createdBy?.toString() === userId.toString() ||
    this.assignedTo?.toString() === userId.toString() ||
    this.assignedBy?.toString() === userId.toString()
  );
};

/**
 * Add a comment to the task
 */
taskSchema.methods.addComment = function (text, authorId, mentions = []) {
  this.comments.push({
    text,
    author: authorId,
    mentions,
    createdAt: new Date(),
  });
  return this.save();
};

/**
 * Add a subtask
 */
taskSchema.methods.addSubtask = function (title, description = "") {
  const order = this.subtasks.length;
  this.subtasks.push({
    title,
    description,
    order,
    completed: false,
  });
  return this.save();
};

/**
 * Toggle subtask completion
 */
taskSchema.methods.toggleSubtask = function (subtaskId, userId) {
  const subtask = this.subtasks.id(subtaskId);
  if (!subtask) throw new Error("Subtask not found");

  subtask.completed = !subtask.completed;
  if (subtask.completed) {
    subtask.completedAt = new Date();
    subtask.completedBy = userId;
  } else {
    subtask.completedAt = undefined;
    subtask.completedBy = undefined;
  }

  return this.save();
};

/**
 * Archive task
 */
taskSchema.methods.archive = function (userId) {
  this.isArchived = true;
  this.archivedAt = new Date();
  this.archivedBy = userId;
  return this.save();
};

/**
 * Unarchive task
 */
taskSchema.methods.unarchive = function () {
  this.isArchived = false;
  this.archivedAt = undefined;
  this.archivedBy = undefined;
  return this.save();
};

/**
 * Add watcher to task
 */
taskSchema.methods.addWatcher = function (userId) {
  if (!this.watchers.includes(userId)) {
    this.watchers.push(userId);
  }
  return this.save();
};

/**
 * Remove watcher from task
 */
taskSchema.methods.removeWatcher = function (userId) {
  this.watchers = this.watchers.filter(
    (id) => id.toString() !== userId.toString()
  );
  return this.save();
};

/**
 * Track view
 */
taskSchema.methods.trackView = function (userId) {
  this.metadata.viewCount = (this.metadata.viewCount || 0) + 1;
  this.metadata.lastViewedAt = new Date();
  this.metadata.lastViewedBy = userId;
  return this.save();
};

// ============================================
// STATIC METHODS
// ============================================

/**
 * Get overdue tasks
 */
taskSchema.statics.getOverdue = function (venueId) {
  return this.find({
    venueId,
    dueDate: { $lt: new Date() },
    status: { $nin: ["completed", "cancelled"] },
    isArchived: false,
  }).sort({ dueDate: 1 });
};

/**
 * Get tasks due today
 */
taskSchema.statics.getDueToday = function (venueId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return this.find({
    venueId,
    dueDate: { $gte: today, $lt: tomorrow },
    status: { $nin: ["completed", "cancelled"] },
    isArchived: false,
  }).sort({ dueDate: 1 });
};

/**
 * Get tasks by user
 */
taskSchema.statics.getByUser = function (userId, venueId, includeCompleted = false) {
  const query = {
    venueId,
    assignedTo: userId,
    isArchived: false,
  };

  if (!includeCompleted) {
    query.status = { $nin: ["completed", "cancelled"] };
  }

  return this.find(query).sort({ dueDate: 1, priority: -1 });
};

/**
 * Get task statistics
 */
taskSchema.statics.getStatistics = async function (venueId) {
  const stats = await this.aggregate([
    { $match: { venueId: new mongoose.Types.ObjectId(venueId), isArchived: false } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        completed: {
          $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
        },
        inProgress: {
          $sum: { $cond: [{ $eq: ["$status", "in_progress"] }, 1, 0] },
        },
        pending: {
          $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
        },
        todo: {
          $sum: { $cond: [{ $eq: ["$status", "todo"] }, 1, 0] },
        },
        blocked: {
          $sum: { $cond: [{ $eq: ["$status", "blocked"] }, 1, 0] },
        },
        cancelled: {
          $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
        },
        overdue: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $lt: ["$dueDate", new Date()] },
                  { $ne: ["$status", "completed"] },
                  { $ne: ["$status", "cancelled"] },
                ],
              },
              1,
              0,
            ],
          },
        },
        highPriority: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $or: [
                    { $eq: ["$priority", "high"] },
                    { $eq: ["$priority", "urgent"] }
                  ]},
                  { $ne: ["$status", "completed"] },
                  { $ne: ["$status", "cancelled"] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  return stats[0] || {
    total: 0,
    completed: 0,
    inProgress: 0,
    pending: 0,
    todo: 0,
    blocked: 0,
    cancelled: 0,
    overdue: 0,
    highPriority: 0,
  };
};

// ============================================
// CASCADE DELETE
// ============================================
taskSchema.pre("deleteOne", { document: true }, async function (next) {
  // Remove task references from dependencies
  await this.model("Task").updateMany(
    { "dependencies.task": this._id },
    { $pull: { dependencies: { task: this._id } } }
  );

  // Delete related reminders
  const Reminder = mongoose.model("Reminder");
  await Reminder.deleteMany({ relatedTask: this._id });

  next();
});

// Enable virtuals in JSON
taskSchema.set("toJSON", { virtuals: true });
taskSchema.set("toObject", { virtuals: true });

export default mongoose.model("Task", taskSchema);