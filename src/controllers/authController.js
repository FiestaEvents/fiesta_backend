import crypto from "crypto";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

// Middleware & Utils
import asyncHandler from "../middleware/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import config from "../config/env.js";
import { generateToken } from "../utils/tokenService.js";
import { sendWelcomeEmail, sendPasswordResetEmail } from "../services/emailService.js";

// Models & Config
import { User, Venue, Role, Permission, VenueSpace } from "../models/index.js";
import { PERMISSIONS } from "../config/permissions.js";
import { DEFAULT_ROLES } from "../config/roles.js";

// =============================================================================
// 🛠️ HELPER FUNCTIONS
// =============================================================================

/**
 * Configure secure cookie options based on environment
 */
const getCookieOptions = () => {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    httpOnly: true, // Prevents XSS
    secure: isProduction, // HTTPS only in prod
    sameSite: isProduction ? "strict" : "lax", // CSRF protection
    path: "/",
  };
};

/**
 * Flatten complex permission objects into a simple array of strings
 */
const getPermissionsList = (user) => {
  const effectivePermissions = new Set();

  // 1. Role Permissions
  if (user.roleId?.permissions?.length) {
    user.roleId.permissions.forEach((p) => {
      if (typeof p === "object" && p.name) effectivePermissions.add(p.name);
    });
  }

  // 2. Custom Granted
  if (user.customPermissions?.granted?.length) {
    user.customPermissions.granted.forEach((p) => {
      if (typeof p === "object" && p.name) effectivePermissions.add(p.name);
    });
  }

  // 3. Custom Revoked
  if (user.customPermissions?.revoked?.length) {
    const revokedNames = user.customPermissions.revoked.map((p) =>
      typeof p === "object" ? p.name : p
    );
    revokedNames.forEach((name) => effectivePermissions.delete(name));
  }

  return Array.from(effectivePermissions);
};

/**
 * Standardize API Response for User Data
 */
const formatAuthResponse = (user) => {
  return {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatar: user.avatar,
      role: user.roleId
        ? {
            id: user.roleId._id,
            name: user.roleId.name,
            type: user.roleType,
            level: user.roleId.level,
          }
        : null,
      venue: user.venueId
        ? {
            id: user.venueId._id,
            name: user.venueId.name,
          }
        : null,
      permissions: getPermissionsList(user),
    },
  };
};

/**
 * Background Task: Initialize Venue Data (Roles, Spaces, Permissions)
 */
const completeVenueSetupAsync = async ({
  venueId,
  userId,
  spaces,
  userEmail,
  userName,
  venueName,
}) => {
  try {
    // 1. Seed Permissions
    const permissionOps = PERMISSIONS.map((perm) => ({
      updateOne: {
        filter: { name: perm.name },
        update: { $set: { ...perm, isArchived: false } },
        upsert: true,
      },
    }));
    if (permissionOps.length > 0) await Permission.bulkWrite(permissionOps);

    const allPermissions = await Permission.find({ isArchived: false });
    const permissionMap = allPermissions.reduce((acc, p) => {
      acc[p.name] = p._id;
      return acc;
    }, {});

    // 2. Create Default Roles
    const rolePromises = DEFAULT_ROLES.map(async (roleConfig) => {
      if (roleConfig.name === "Owner") return null;
      
      const permissionIds = roleConfig.permissions === "ALL"
        ? allPermissions.map((p) => p._id)
        : roleConfig.permissions
            .map((name) => permissionMap[name])
            .filter(Boolean);

      return Role.create({
        ...roleConfig,
        permissions: permissionIds,
        venueId,
        isArchived: false,
      });
    }).filter(Boolean);

    await Promise.all(rolePromises);

    // 3. Update Owner Permissions
    const ownerRole = await Role.findOne({ venueId, name: "Owner" });
    if (ownerRole) {
      ownerRole.permissions = allPermissions.map((p) => p._id);
      await ownerRole.save();
    }

    // 4. Create Venue Spaces
    if (spaces?.length > 0) {
      const spaceDocs = spaces.map((space) => ({
        name: space.name,
        description: space.description || `Welcome to ${space.name}`,
        capacity: {
          min: parseInt(space.minCapacity) || 1,
          max: parseInt(space.maxCapacity) || 100,
        },
        basePrice: parseFloat(space.basePrice) || 0,
        amenities: space.amenities || [],
        venueId,
        owner: userId,
        isActive: true,
        isArchived: false,
        timeZone: "UTC",
      }));
      await VenueSpace.insertMany(spaceDocs);
    }

    // 5. Send Welcome Email
    try {
      await sendWelcomeEmail({
        email: userEmail,
        userName,
        venueName,
        spacesCount: spaces?.length || 0,
      });
    } catch (e) {
      console.error("Email service failed:", e.message);
    }

    console.log(`✅ Setup completed for venue: ${venueName}`);
  } catch (error) {
    console.error("❌ Async setup error:", error);
  }
};

// =============================================================================
// 🔐 CORE AUTH CONTROLLERS
// =============================================================================

/**
 * @desc    Login user & set HttpOnly cookie
 * @route   POST /api/v1/auth/login
 */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email, isArchived: false })
    .select("+password")
    .populate("venueId")
    .populate({
      path: "roleId",
      populate: { path: "permissions", model: "Permission" },
    })
    .populate("customPermissions.granted")
    .populate("customPermissions.revoked");

  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError("Invalid credentials", 401);
  }

  if (!user.isActive) {
    throw new ApiError("Your account has been deactivated", 403);
  }

  if (user.venueId?.subscription?.status !== "active") {
    throw new ApiError("Venue subscription is inactive", 403);
  }

  // Update Login Stats
  user.lastLogin = new Date();
  await user.save();

  // Set Cookie
  const token = generateToken(user._id);
  res.cookie("jwt", token, getCookieOptions());

  new ApiResponse(formatAuthResponse(user), "Login successful").send(res);
});

/**
 * @desc    Get current user profile (Session Check)
 * @route   GET /api/v1/auth/me
 */
export const getCurrentUser = asyncHandler(async (req, res) => {
  let user = req.user;

  // Ensure deep population if middleware didn't provide it
  const isPermissionsPopulated = 
    user.roleId?.permissions?.length > 0 && 
    typeof user.roleId.permissions[0] === "object";

  if (!isPermissionsPopulated) {
    user = await User.findById(req.user._id)
      .populate("venueId")
      .populate({
        path: "roleId",
        populate: { path: "permissions", model: "Permission" },
      })
      .populate("customPermissions.granted")
      .populate("customPermissions.revoked");
  }

  new ApiResponse(formatAuthResponse(user)).send(res);
});

/**
 * @desc    Register new venue owner
 * @route   POST /api/v1/auth/register
 */
export const register = asyncHandler(async (req, res) => {
  const {
    name,
    email,
    password,
    phone,
    description,
    venueName,
    address,
    spaces = [],
  } = req.body;

  if (await User.findOne({ email, isArchived: false })) {
    throw new ApiError("Email already registered", 400);
  }

  // 1. Create Venue
  const venue = await Venue.create({
    name: venueName,
    description: description || `Welcome to ${venueName}`,
    address: address || {},
    contact: { phone, email },
    capacity: { min: 50, max: 500 },
    pricing: { basePrice: 0 },
    subscription: {
      plan: "free",
      status: "active",
      startDate: new Date(),
      amount: 0,
    },
    owner: null, // Linked later
    isArchived: false,
  });

  // 2. Create Owner Role (Placeholder)
  const ownerRole = await Role.create({
    name: "Owner",
    description: "Venue owner with full permissions",
    level: 100,
    permissions: [], // Populated async
    venueId: venue._id,
    isSystemRole: true,
    isArchived: false,
  });

  // 3. Create User
  const user = await User.create({
    name,
    email,
    password,
    phone,
    roleId: ownerRole._id,
    roleType: "owner",
    venueId: venue._id,
    isArchived: false,
  });

  // 4. Link Venue Owner
  venue.owner = user._id;
  await venue.save();

  // 5. Set Cookie & Response
  const token = generateToken(user._id);
  res.cookie("jwt", token, getCookieOptions());

  // Construct initial response manually (DB population not ready yet)
  const initialResponse = {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: { id: ownerRole._id, name: "Owner", type: "owner", level: 100 },
      venue: { id: venue._id, name: venue.name },
      permissions: [], 
    },
    setupStatus: "in_progress",
  };

  new ApiResponse(initialResponse, "Registration successful", 201).send(res);

  // 6. Trigger Background Setup
  completeVenueSetupAsync({
    venueId: venue._id,
    userId: user._id,
    spaces,
    userEmail: email,
    userName: name,
    venueName,
  });
});

/**
 * @desc    Logout user & clear cookie
 * @route   POST /api/v1/auth/logout
 */
export const logout = asyncHandler(async (req, res) => {
  res.cookie("jwt", "loggedout", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });
  new ApiResponse(null, "Logout successful").send(res);
});

// =============================================================================
// 👤 PROFILE & ACCOUNT MANAGEMENT
// =============================================================================

export const verifyEmail = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email, isArchived: false });
  if (user) throw new ApiError("Email is already taken", 401);
  return res.status(200).send({ message: "Email is available" });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const { name, phone, avatar } = req.body;
  const user = await User.findOne({ _id: req.user._id, isArchived: false });

  if (!user) throw new ApiError("User not found", 404);

  if (name) user.name = name;
  if (phone) user.phone = phone;
  if (avatar !== undefined) user.avatar = avatar;

  await user.save();

  const updatedUser = await User.findById(user._id)
    .populate("venueId")
    .populate({ path: "roleId", populate: { path: "permissions" } });

  new ApiResponse(
    formatAuthResponse(updatedUser),
    "Profile updated successfully"
  ).send(res);
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findOne({ _id: req.user._id }).select("+password");

  if (!user) throw new ApiError("User not found", 404);

  if (!(await user.comparePassword(currentPassword))) {
    throw new ApiError("Current password is incorrect", 400);
  }

  user.password = newPassword;
  await user.save();

  new ApiResponse(null, "Password changed successfully").send(res);
});

// =============================================================================
// 🔄 PASSWORD RESET & RECOVERY
// =============================================================================

export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email, isArchived: false });

  if (!user) {
    return new ApiResponse(null, "If registered, you will receive an email").send(res);
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  user.resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex");
  user.resetPasswordExpire = Date.now() + 60 * 60 * 1000;
  await user.save();

  try {
    await sendPasswordResetEmail({
      email: user.email,
      resetToken,
      userName: user.name,
    });
    new ApiResponse(null, "Password reset link sent").send(res);
  } catch (error) {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();
    throw new ApiError("Failed to send email", 500);
  }
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpire: { $gt: Date.now() },
    isArchived: false,
  });

  if (!user) throw new ApiError("Invalid or expired token", 400);

  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  new ApiResponse(null, "Password reset successful").send(res);
});

// =============================================================================
// 📦 ARCHIVE & RESTORE
// =============================================================================

export const archiveAccount = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) throw new ApiError("User not found", 404);

  user.isArchived = true;
  user.archivedAt = new Date();
  await user.save();

  new ApiResponse(null, "Account archived").send(res);
});

export const restoreAccount = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email, isArchived: true });

  if (!user) throw new ApiError("No archived account found", 404);

  user.isArchived = false;
  user.archivedAt = undefined;
  await user.save();

  new ApiResponse(null, "Account restored").send(res);
});

/**
 * @desc    Get user stats (Admin)
 * @route   GET /api/v1/auth/stats
 */
export const getUserStats = asyncHandler(async (req, res) => {
  const venueId = new mongoose.Types.ObjectId(req.user.venueId);
  const stats = await User.aggregate([
    { $match: { venueId } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        active: { $sum: { $cond: ["$isActive", 1, 0] } },
        archived: { $sum: { $cond: ["$isArchived", 1, 0] } },
      },
    },
  ]);

  const result = stats[0] || { total: 0, active: 0, archived: 0 };
  new ApiResponse(result).send(res);
});