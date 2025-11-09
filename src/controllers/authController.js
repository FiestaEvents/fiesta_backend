import crypto from "crypto";
import asyncHandler from "../middleware/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { generateToken } from "../utils/tokenService.js";
import {
  sendWelcomeEmail,
  sendPasswordResetEmail,
} from "../utils/emailService.js";
import { User, Venue, Role, Permission } from "../models/index.js";
import { PERMISSIONS } from "../config/permissions.js";
import { DEFAULT_ROLES } from "../config/roles.js";

/**
 * @desc    Register new venue owner
 * @route   POST /api/v1/auth/register
 * @access  Public
 */
export const register = asyncHandler(async (req, res) => {
  const { name, email, password, phone, venueName, venueAddress } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiError("Email already registered", 400);
  }

  // Create venue
  const venue = await Venue.create({
    name: venueName,
    description: `Welcome to ${venueName}`,
    address: venueAddress,
    contact: {
      phone,
      email,
    },
    capacity: {
      min: 50,
      max: 500,
    },
    pricing: {
      basePrice: 0,
    },
    subscription: {
      plan: "free",
      status: "active",
      startDate: new Date(),
      amount: 0,
    },
    owner: null,
    timeZone: "UTC",
  });

  // Seed permissions for this venue
  const permissionPromises = PERMISSIONS.map(async (perm) => {
    return Permission.findOneAndUpdate({ name: perm.name }, perm, {
      upsert: true,
      new: true,
    });
  });
  const createdPermissions = await Promise.all(permissionPromises);

  const permissionMap = {};
  createdPermissions.forEach((p) => {
    permissionMap[p.name] = p._id;
  });

  // Create default roles for this venue
  const rolePromises = DEFAULT_ROLES.map(async (roleConfig) => {
    const permissionIds =
      roleConfig.permissions === "ALL"
        ? createdPermissions.map((p) => p._id)
        : roleConfig.permissions
            .map((permName) => permissionMap[permName])
            .filter(Boolean);

    return Role.create({
      ...roleConfig,
      permissions: permissionIds,
      venueId: venue._id,
    });
  });

  const createdRoles = await Promise.all(rolePromises);
  const ownerRole = createdRoles.find((r) => r.name === "Owner");

  // Create user
  const user = await User.create({
    name,
    email,
    password,
    phone,
    roleId: ownerRole._id,
    roleType: "owner",
    venueId: venue._id,
  });

  // Update venue owner
  venue.owner = user._id;
  await venue.save();

  // Generate token
  const token = generateToken(user._id);

  // Send welcome email
  try {
    await sendWelcomeEmail({
      email: user.email,
      userName: user.name,
      venueName: venue.name,
    });
  } catch (error) {
    console.error("Failed to send welcome email:", error);
  }

  // Return response
  new ApiResponse(
    {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: ownerRole.name,
        venue: {
          id: venue._id,
          name: venue.name,
        },
      },
      token,
    },
    "Registration successful",
    201
  ).send(res);
});

/**
 * @desc    Login user
 * @route   POST /api/v1/auth/login
 * @access  Public
 */
export const verifyEmail = asyncHandler(async (req, res) => {
  const { email } = req.body;

  // Check if user exists
  const user = await User.findOne({ email });

  if (user) {
    throw new ApiError("Try another email", 401);
  }

  // Return
  res.status(200);
});

/**
 * @desc    Login user
 * @route   POST /api/v1/auth/login
 * @access  Public
 */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Check if user exists (include password for comparison)
  const user = await User.findOne({ email })
    .select("+password")
    .populate("roleId")
    .populate("venueId");

  if (!user) {
    throw new ApiError("Invalid credentials", 401);
  }

  // Check if user is active
  if (!user.isActive) {
    throw new ApiError("Your account has been deactivated", 403);
  }

  // Check password
  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    throw new ApiError("Invalid credentials", 401);
  }

  // Check venue subscription
  if (user.venueId.subscription.status !== "active") {
    throw new ApiError("Venue subscription is inactive", 403);
  }

  // Update last login
  user.lastLogin = new Date();
  await user.save();

  // Get user permissions
  const permissions = await user.getPermissions();
  const populatedPermissions = await Permission.find({
    _id: { $in: permissions },
  });

  // Generate token
  const token = generateToken(user._id);

  // Return response
  new ApiResponse(
    {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
        role: {
          id: user.roleId._id,
          name: user.roleId.name,
          type: user.roleType,
          level: user.roleId.level,
        },
        venue: {
          id: user.venueId._id,
          name: user.venueId.name,
        },
        permissions: populatedPermissions.map((p) => ({
          id: p._id,
          name: p.name,
          displayName: p.displayName,
          module: p.module,
          action: p.action,
          scope: p.scope,
        })),
      },
      token,
    },
    "Login successful"
  ).send(res);
});

/**
 * @desc    Get current user
 * @route   GET /api/v1/auth/me
 * @access  Private
 */
export const getCurrentUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate("roleId")
    .populate("venueId");

  if (!user) {
    throw new ApiError("User not found", 404);
  }

  // Get user permissions
  const permissions = await user.getPermissions();
  const populatedPermissions = await Permission.find({
    _id: { $in: permissions },
  });

  new ApiResponse({
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatar: user.avatar,
      role: {
        id: user.roleId._id,
        name: user.roleId.name,
        type: user.roleType,
        level: user.roleId.level,
      },
      venue: {
        id: user.venueId._id,
        name: user.venueId.name,
      },
      permissions: populatedPermissions.map((p) => ({
        id: p._id,
        name: p.name,
        displayName: p.displayName,
        module: p.module,
        action: p.action,
        scope: p.scope,
      })),
    },
  }).send(res);
});

/**
 * @desc    Update user profile
 * @route   PUT /api/v1/auth/profile
 * @access  Private
 */
export const updateProfile = asyncHandler(async (req, res) => {
  const { name, phone, avatar } = req.body;

  const user = await User.findById(req.user._id);

  if (!user) {
    throw new ApiError("User not found", 404);
  }

  // Update fields
  if (name) user.name = name;
  if (phone) user.phone = phone;
  if (avatar) user.avatar = avatar;

  await user.save();

  new ApiResponse(
    {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
      },
    },
    "Profile updated successfully"
  ).send(res);
});

/**
 * @desc    Change password
 * @route   PUT /api/v1/auth/change-password
 * @access  Private
 */
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select("+password");

  if (!user) {
    throw new ApiError("User not found", 404);
  }

  // Verify current password
  const isPasswordValid = await user.comparePassword(currentPassword);
  if (!isPasswordValid) {
    throw new ApiError("Current password is incorrect", 400);
  }

  // Update password
  user.password = newPassword;
  await user.save();

  new ApiResponse(null, "Password changed successfully").send(res);
});

/**
 * @desc    Forgot password
 * @route   POST /api/v1/auth/forgot-password
 * @access  Public
 */
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });

  if (!user) {
    // Don't reveal if user exists
    new ApiResponse(
      null,
      "If your email is registered, you will receive a password reset link"
    ).send(res);
    return;
  }

  // Generate reset token
  const resetToken = crypto.randomBytes(32).toString("hex");
  user.resetPasswordToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  user.resetPasswordExpire = Date.now() + 60 * 60 * 1000; // 1 hour

  await user.save();

  // Send email
  try {
    await sendPasswordResetEmail({
      email: user.email,
      resetToken,
      userName: user.name,
    });

    new ApiResponse(null, "Password reset link sent to your email").send(res);
  } catch (error) {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    throw new ApiError("Failed to send password reset email", 500);
  }
});

/**
 * @desc    Reset password
 * @route   POST /api/v1/auth/reset-password
 * @access  Public
 */
export const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;

  // Hash token
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  // Find user by token
  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpire: { $gt: Date.now() },
  });

  if (!user) {
    throw new ApiError("Invalid or expired reset token", 400);
  }

  // Update password
  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;

  await user.save();

  new ApiResponse(null, "Password reset successful").send(res);
});

/**
 * @desc    Logout user
 * @route   POST /api/v1/auth/logout
 * @access  Private
 */
export const logout = asyncHandler(async (req, res) => {
  // In a stateless JWT setup, logout is handled client-side by removing the token
  // If you implement token blacklisting, add that logic here

  new ApiResponse(null, "Logout successful").send(res);
});
