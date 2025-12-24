// src/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: [true, "Name is required"],
      trim: true,
    },
    email: { 
      type: String, 
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
    },
    password: { 
      type: String, 
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false, // Don't return password by default
    },
    phone: { 
      type: String,
      trim: true,
    },
    
    // =========================================================
    // ARCHITECTURE UPDATE: References Business (Venue, Driver, etc.)
    // =========================================================
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business", 
      // Platform Admins don't need a business, everyone else does
      required: function() { return !this.isSuperAdmin; },
    },
    
    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
    },
    
    // Generic Role Types (used for UI logic before RBAC loads)
    roleType: {
      type: String,
      enum: ["owner", "manager", "staff", "viewer", "custom"],
      default: "viewer",
    },
    
    // THE GOD MODE FLAG (Platform Admin)
    isSuperAdmin: {
      type: Boolean,
      default: false,
    },
    
    // Granular Permission Overrides
    customPermissions: {
      granted: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Permission",
        },
      ],
      revoked: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Permission",
        },
      ],
    },
    
    // Profile & Meta
    avatar: { type: String },
    lastLogin: { type: Date },
    isActive: { type: Boolean, default: true },
    
    // Soft Delete
    isArchived: { type: Boolean, default: false },
    archivedAt: { type: Date },
    archivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    
    // Invitation Tracking
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    invitedAt: { type: Date },
    acceptedAt: { type: Date },
    
    // Password Reset
    resetPasswordToken: String,
    resetPasswordExpire: Date,
  },
  {
    timestamps: true,
  }
);

// Encrypt password using bcrypt
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Match user entered password to hashed password in database
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Flatten permissions (Role Permissions + Custom Granted - Custom Revoked)
userSchema.methods.getPermissions = async function () {
  // Populate the role and its permissions
  await this.populate({
    path: "roleId",
    populate: { path: "permissions" },
  });

  if (!this.roleId || !this.roleId.permissions) return [];

  // Start with Role Permissions
  let permissions = this.roleId.permissions.map((p) => p._id.toString());

  // Add Custom Granted
  if (this.customPermissions?.granted) {
    permissions = [
      ...permissions,
      ...this.customPermissions.granted.map((p) => p.toString()),
    ];
  }

  // Remove Custom Revoked
  if (this.customPermissions?.revoked) {
    const revoked = this.customPermissions.revoked.map((p) => p.toString());
    permissions = permissions.filter((p) => !revoked.includes(p));
  }

  // Return unique list
  return [...new Set(permissions)];
};

// Quick check helper
userSchema.methods.hasPermission = async function (permissionName) {
  const Permission = mongoose.model("Permission");
  const permission = await Permission.findOne({ name: permissionName });

  if (!permission) return false;

  const userPermissions = await this.getPermissions();
  return userPermissions.includes(permission._id.toString());
};

module.exports = mongoose.model("User", userSchema);