import mongoose from "mongoose";
import bcrypt from "bcryptjs";

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
  select: false,
},
    phone: { 
      type: String,
      trim: true,
    },
    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
    },
    roleType: {
      type: String,
      enum: ["owner", "manager", "staff", "viewer", "custom"],
      default: "viewer",
    },
    venueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Venue",
      required: [true, "Venue is required"],
    },
    isActive: { type: Boolean, default: true },
    isArchived: { type: Boolean, default: false },
    archivedAt: { type: Date },
    archivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
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
    avatar: { type: String },
    lastLogin: { type: Date },
    isActive: { type: Boolean, default: true },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    invitedAt: { type: Date },
    acceptedAt: { type: Date },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
  },
  {
    timestamps: true,
  }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.getPermissions = async function () {
  await this.populate({
    path: "roleId",
    populate: { path: "permissions" },
  });

  if (!this.roleId || !this.roleId.permissions) return [];

  let permissions = this.roleId.permissions.map((p) => p._id.toString());

  if (this.customPermissions?.granted) {
    permissions = [
      ...permissions,
      ...this.customPermissions.granted.map((p) => p.toString()),
    ];
  }

  if (this.customPermissions?.revoked) {
    const revoked = this.customPermissions.revoked.map((p) => p.toString());
    permissions = permissions.filter((p) => !revoked.includes(p));
  }

  return [...new Set(permissions)];
};

userSchema.methods.hasPermission = async function (permissionName) {
  const Permission = mongoose.model("Permission");
  const permission = await Permission.findOne({ name: permissionName });

  if (!permission) return false;

  const userPermissions = await this.getPermissions();
  return userPermissions.includes(permission._id.toString());
};

export default mongoose.model("User", userSchema);