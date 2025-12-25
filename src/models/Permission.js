import mongoose from "mongoose";

const permissionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true, // e.g., "events.create.all"
    },
    displayName: {
      type: String,
      required: true, // e.g., "Create All Events"
    },
    description: {
      type: String,
      maxlength: [200, "Description cannot exceed 200 characters"],
    },
    module: {
      type: String,
      required: true,
      enum: [
        "events",       // Core Job/Event management
        "clients",
        "partners",
        "finance",
        "payments",
        "invoices",   
        "contracts",  
        "supplies",     // Consumables (Food, Paper, etc.)
        "inventory",    // Assets (Cameras, Vehicles, Sound Equipment)
        "portfolio",    // For Photographers/Creatives to manage galleries
        "tasks",
        "reminders",
        "users",
        "roles",
        "business",     // Generalizes 'venue' (Profile, Operating Hours)
        "venue",        // KEPT FOR MIGRATION: Specific venue features (Spaces)
        "resources",    // Replaces 'venue' spaces for generic booking (Rooms, Vehicles)
        "reports",
        "settings",     // Global app settings
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

// Prevent duplicate permissions (e.g., cannot have two "events.create.all")
permissionSchema.index({ module: 1, action: 1, scope: 1 }, { unique: true });

export default mongoose.model("Permission", permissionSchema);