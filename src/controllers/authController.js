import crypto from "crypto";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

// Middleware & Utils
import asyncHandler from "../middleware/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import config from "../config/env.js";
import { generateToken } from "../utils/tokenService.js";
// import { sendWelcomeEmail, sendPasswordResetEmail } from "../services/emailService.js";

// Models
import { User, Business, Role, Permission, Space } from "../models/index.js";
import { PERMISSIONS } from "../config/permissions.js";
import { DEFAULT_ROLES } from "../config/roles.js";

// =============================================================================
// 🛠️ HELPER FUNCTIONS
// =============================================================================

const getCookieOptions = () => {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "strict" : "lax",
    path: "/",
  };
};

const getPermissionsList = (user) => {
  const effectivePermissions = new Set();
  if (user.roleId?.permissions?.length) {
    user.roleId.permissions.forEach((p) => {
      if (typeof p === "object" && p.name) effectivePermissions.add(p.name);
    });
  }
  if (user.customPermissions?.granted?.length) {
    user.customPermissions.granted.forEach((p) => {
      if (typeof p === "object" && p.name) effectivePermissions.add(p.name);
    });
  }
  if (user.customPermissions?.revoked?.length) {
    const revokedNames = user.customPermissions.revoked.map((p) =>
      typeof p === "object" ? p.name : p
    );
    revokedNames.forEach((name) => effectivePermissions.delete(name));
  }
  return Array.from(effectivePermissions);
};

const formatAuthResponse = (user) => {
  return {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatar: user.avatar,
      isSuperAdmin: user.isSuperAdmin,
      role: user.roleId
        ? {
            id: user.roleId._id,
            name: user.roleId.name,
            type: user.roleType,
            level: user.roleId.level,
          }
        : null,
      business: user.businessId
        ? {
            id: user.businessId._id,
            name: user.businessId.name,
            category: user.businessId.category,
            subscription: user.businessId.subscription,
          }
        : null,
      permissions: getPermissionsList(user),
    },
  };
};

/**
 * Background Task: Initialize Business Data
 */
const completeBusinessSetupAsync = async ({
  businessId,
  userId,
  category,
  spaces,
  userEmail,
  userName,
  businessName,
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

      const permissionIds =
        roleConfig.permissions === "ALL"
          ? allPermissions.map((p) => p._id)
          : roleConfig.permissions
              .map((name) => permissionMap[name])
              .filter(Boolean);

      return Role.create({
        ...roleConfig,
        permissions: permissionIds,
        businessId,
        isArchived: false,
      });
    }).filter(Boolean);

    await Promise.all(rolePromises);

    // 3. Update Owner Permissions (Grant ALL)
    const ownerRole = await Role.findOne({ businessId, name: "Owner" });
    if (ownerRole) {
      ownerRole.permissions = allPermissions.map((p) => p._id);
      await ownerRole.save();
    }

    // 4. Create Venue Spaces
    if (category === "venue" && spaces?.length > 0) {
      const spaceDocs = spaces.map((space) => ({
        name: space.name,
        type: "room",
        description: space.description || `Space at ${businessName}`,
        capacity: {
          min: parseInt(space.minCapacity) || 1,
          max: parseInt(space.maxCapacity) || 100,
        },
        basePrice: parseFloat(space.basePrice) || 0,
        amenities: space.amenities || [],
        businessId,
        owner: userId,
        isActive: true,
        isArchived: false,
        timeZone: "Africa/Tunis",
      }));
      await Space.insertMany(spaceDocs);
    }

    console.log(
      `✅ Setup completed for business: ${businessName} (${category})`
    );
  } catch (error) {
    console.error("❌ Async setup error:", error);
  }
};

// =============================================================================
// 🔐 CORE AUTH CONTROLLERS
// =============================================================================

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email, isArchived: false })
    .select("+password")
    .populate("businessId")
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

  user.lastLogin = new Date();
  await user.save();

  const token = generateToken(user._id);
  res.cookie("jwt", token, getCookieOptions());

  new ApiResponse(formatAuthResponse(user), "Login successful").send(res);
});

export const getCurrentUser = asyncHandler(async (req, res) => {
  let user = req.user;

  const isPermissionsPopulated =
    user.roleId?.permissions?.length > 0 &&
    typeof user.roleId.permissions[0] === "object";

  if (!isPermissionsPopulated) {
    user = await User.findById(req.user._id)
      .populate("businessId")
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
 * @desc    Register new Business Owner (Chameleon Flow)
 * @route   POST /api/v1/auth/register
 */
export const register = asyncHandler(async (req, res) => {
  const {
    name,
    email,
    password,
    phone,
    businessName,
    category = "venue",
    description,
    address,
    spaces = [],
    serviceRadius,
    pricingModel,
  } = req.body;

  // Validation: Duplicate Email
  if (await User.findOne({ email, isArchived: false })) {
    throw new ApiError("Email already registered", 400);
  }

  // ✅ 1. PRE-GENERATE IDs TO RESOLVE CIRCULAR DEPENDENCY
  const businessId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  const roleId = new mongoose.Types.ObjectId();

  // 2. Prepare Business Data
   const businessData = {
    _id: businessId, 
    name: businessName,
    description: description || `Welcome to ${businessName}`,
    category,
    contact: { phone, email },
    address: address || {},
    subscription: {
      plan: "free",
      status: "active",
      startDate: new Date(),
    },
    owner: userId,
    isArchived: false,
  };

  if (category === 'venue') {
    businessData.venueDetails = {
      capacity: { min: 0, max: 0 }, 
      amenities: []
    };
    businessData.serviceDetails = undefined; 
  } else {
    // It's a service provider
    businessData.serviceDetails = {
      serviceRadiusKM: serviceRadius || 50, 
      pricingModel: pricingModel || 'fixed',
      travelFee: 0,
      portfolio: []
    };
    businessData.venueDetails = undefined;
  }


  // 3. Prepare Owner Role Data
  const roleData = {
    _id: roleId, // Manual ID
    name: "Owner",
    description: "Business owner with full permissions",
    level: 100,
    permissions: [],
    businessId: businessId, // Link to Business
    isSystemRole: true,
    isArchived: false,
  };

  // 4. Prepare User Data
  const userData = {
    _id: userId, // Manual ID
    name,
    email,
    password, // Will be hashed by pre-save hook
    phone,
    roleId: roleId,
    roleType: "owner",
    businessId: businessId, // Link to Business
    isArchived: false,
  };

  // 5. Execute Transactions
  // We use create() which triggers Mongoose middleware (like password hashing)
  await Business.create(businessData);
  await Role.create(roleData);
  const user = await User.create(userData); // This triggers the pre-save hook for bcrypt

  // 6. Set Cookie & Response
  const token = generateToken(user._id);
  res.cookie("jwt", token, getCookieOptions());

  const initialResponse = {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: { id: roleId, name: "Owner", type: "owner", level: 100 },
      business: {
        id: businessId,
        name: businessName,
        category: category,
      },
      permissions: [],
    },
    setupStatus: "in_progress",
  };

  new ApiResponse(initialResponse, "Registration successful", 201).send(res);

  // 7. Trigger Background Setup
  completeBusinessSetupAsync({
    businessId,
    userId,
    category,
    spaces,
    userEmail: email,
    userName: name,
    businessName,
  });
});

export const logout = asyncHandler(async (req, res) => {
  res.cookie("jwt", "loggedout", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });
  new ApiResponse(null, "Logout successful").send(res);
});

// ... (Rest of file: verifyEmail, updateProfile, changePassword, etc. remain unchanged)
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
    .populate("businessId")
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

export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email, isArchived: false });

  if (!user) {
    return new ApiResponse(
      null,
      "If registered, you will receive an email"
    ).send(res);
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  user.resetPasswordToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  user.resetPasswordExpire = Date.now() + 60 * 60 * 1000;
  await user.save();

  new ApiResponse(
    { debugToken: resetToken },
    "Password reset link generated (Check logs)"
  ).send(res);
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

export const getUserStats = asyncHandler(async (req, res) => {
  const businessId = new mongoose.Types.ObjectId(req.user.businessId);
  const stats = await User.aggregate([
    { $match: { businessId } },
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
