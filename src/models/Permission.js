import mongoose from "mongoose";

const permissionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    displayName: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      maxlength: [200, "Description cannot exceed 200 characters"],
    },
    module: {
      type: String,
      required: true,
      enum: [
        "events",
        "clients",
        "partners",
        "finance",
        "payments",
        "tasks",
        "reminders",
        "users",
        "roles",
        "venue",
        "reports",
        "settings",
      ],
    },
    action: {
      type: String,
      required: true,
      enum: ["create", "read", "update", "delete", "manage", "export"],
    },
    scope: {
      type: String,
      enum: ["own", "team", "all"],
      default: "all",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

permissionSchema.index({ module: 1, action: 1, scope: 1 }, { unique: true });

export default mongoose.model("Permission", permissionSchema);