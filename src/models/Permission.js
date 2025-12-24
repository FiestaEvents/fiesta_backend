// src/models/Permission.js
const mongoose = require('mongoose');

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
        "events",       // Core Job/Event management
        "clients",
        "partners",
        "finance",
        "payments",
        "invoices",   
        "contracts",  
        "supplies",     // Consumables (Food, Paper, etc.)
        "inventory",    // NEW: Assets (Cameras, Vehicles, Sound Equipment)
        "portfolio",    // NEW: For Photographers/Creatives to manage galleries
        "tasks",
        "reminders",
        "users",
        "roles",
        "business",     // NEW: Generalizes 'venue' (Profile, Operating Hours)
        "venue",        // KEPT FOR MIGRATION: Specific venue features (Spaces)
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

permissionSchema.index({ module: 1, action: 1, scope: 1 }, { unique: true });

module.exports = mongoose.model("Permission", permissionSchema);