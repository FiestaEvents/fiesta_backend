// src/models/Role.js
import mongoose from "mongoose";

const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },

    // =========================================================
    // ARCHITECTURE UPDATE: Replaces venueId
    // =========================================================
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    },

    permissions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Permission",
      },
    ],

    // System roles (like 'Owner') cannot be deleted or renamed
    isSystemRole: {
      type: Boolean,
      default: false,
    },

    // Hierarchy level (0 = No Access, 10 = Staff, 100 = Owner/Admin)
    level: {
      type: Number,
      default: 10,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    // Soft Delete
    isArchived: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure Role names are unique PER BUSINESS
// (e.g., Business A can have 'Manager', Business B can have 'Manager')
roleSchema.index({ name: 1, businessId: 1 }, { unique: true });

export default mongoose.model("Role", roleSchema);
