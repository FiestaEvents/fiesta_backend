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
import VenueSpace from "../models/VenueSpace.js";

/**
 * @desc    Register new venue owner
 * @route   POST /api/v1/auth/register
 * @access  Public
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

  // Check if user already exists
  const existingUser = await User.findOne({ email, isArchived: false });
  if (existingUser) {
    throw new ApiError("Email already registered", 400);
  }

  // Format address object (minimal processing)
  const formattedAddress = {
    street: address?.street || "",
    city: address?.city || "",
    state: address?.state || "",
    zipCode: address?.zipCode || "",
    country: address?.country || "",
  };

  // Create basic venue first (fast operation)
  const venue = await Venue.create({
    name: venueName,
    description: description || `Welcome to ${venueName}`,
    address: formattedAddress,
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
    isArchived: false,
  });

  // Create basic owner role (fast operation)
  const ownerRole = await Role.create({
    name: "Owner",
    description: "Venue owner with full permissions",
    level: 100,
    permissions: [],
    venueId: venue._id,
    isSystemRole: true,
    isArchived: false,
  });

  // Create user (fast operation)
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

  // Update venue owner
  venue.owner = user._id;
  await venue.save();

  // Generate token (fast operation)
  const token = generateToken(user._id);

  // Return immediate response with user details
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
      setupStatus: "in_progress",
    },
    "Registration successful. Your venue setup is being completed in the background.",
    201
  ).send(res);

  // Continue with heavy processing asynchronously after sending response
  completeVenueSetupAsync({
    venueId: venue._id,
    userId: user._id,
    spaces,
    userEmail: email,
    userName: name,
    venueName: venueName,
  });
});

/**
 * Async function to handle the heavy venue setup after response is sent
 */
const completeVenueSetupAsync = async (setupData) => {
  const { venueId, userId, spaces, userEmail, userName, venueName } = setupData;

  try {
    // Seed permissions for this venue (heavy operation)
    const permissionPromises = PERMISSIONS.map(async (perm) => {
      return Permission.findOneAndUpdate(
        { name: perm.name }, 
        { ...perm, isArchived: false },
        {
          upsert: true,
          new: true,
        }
      );
    });
    const createdPermissions = await Promise.all(permissionPromises);

    const permissionMap = {};
    createdPermissions.forEach((p) => {
      permissionMap[p.name] = p._id;
    });

    // Create all default roles with proper permissions (heavy operation)
    const rolePromises = DEFAULT_ROLES.map(async (roleConfig) => {
      // Skip owner role as it's already created
      if (roleConfig.name === "Owner") return null;

      const permissionIds =
        roleConfig.permissions === "ALL"
          ? createdPermissions.map((p) => p._id)
          : roleConfig.permissions
              .map((permName) => permissionMap[permName])
              .filter(Boolean);

      return Role.create({
        ...roleConfig,
        permissions: permissionIds,
        venueId: venueId,
        isArchived: false,
      });
    }).filter(Boolean); // Remove null promises

    const createdRoles = await Promise.all(rolePromises);

    // Update owner role with full permissions
    const ownerRole = await Role.findOne({ venueId: venueId, name: "Owner", isArchived: false });
    if (ownerRole) {
      ownerRole.permissions = createdPermissions.map((p) => p._id);
      await ownerRole.save();
    }

    // Create venue spaces if provided (heavy operation)
    let createdSpaces = [];
    if (spaces && spaces.length > 0) {
      const spacePromises = spaces.map(async (space) => {
        const venueSpace = await VenueSpace.create({
          name: space.name,
          description: space.description || `Welcome to ${space.name}`,
          capacity: {
            min: parseInt(space.minCapacity) || 1,
            max: parseInt(space.maxCapacity) || 100,
          },
          basePrice: parseFloat(space.basePrice) || 0,
          amenities: space.amenities || [],
          images: space.images || [],
          operatingHours: {
            monday: { open: "09:00", close: "18:00", closed: false },
            tuesday: { open: "09:00", close: "18:00", closed: false },
            wednesday: { open: "09:00", close: "18:00", closed: false },
            thursday: { open: "09:00", close: "18:00", closed: false },
            friday: { open: "09:00", close: "18:00", closed: false },
            saturday: { open: "09:00", close: "18:00", closed: false },
            sunday: { open: "09:00", close: "18:00", closed: false },
          },
          venueId: venueId,
          owner: userId,
          isReserved: false,
          isActive: true,
          isArchived: false,
          timeZone: "UTC",
        });
        return venueSpace;
      });

      createdSpaces = await Promise.all(spacePromises);
    }

    // Send welcome email (heavy operation)
    try {
      await sendWelcomeEmail({
        email: userEmail,
        userName: userName,
        venueName: venueName,
        spacesCount: createdSpaces.length,
      });
    } catch (error) {
      console.error("Failed to send welcome email:", error);
    }

    console.log(`Venue setup completed successfully for user: ${userEmail}`);
  } catch (error) {
    console.error("Error during async venue setup:", error);
    // Here you could implement error handling like sending an error notification email
    // or updating a setup status in the database
  }
};

/**
 * @desc    Verify email availability
 * @route   POST /api/v1/auth/verify-email
 * @access  Public
 */
export const verifyEmail = asyncHandler(async (req, res) => {
  const { email } = req.body;
  // Check if active user exists
  const user = await User.findOne({ email, isArchived: false });
  if (user) {
    throw new ApiError("Try another email", 401);
  }
  // Return
  return res.status(200).send({ message: "Email is available" });
});

/**
 * @desc    Login user
 * @route   POST /api/v1/auth/login
 * @access  Public
 */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Check if user exists (include password for comparison) - exclude archived users
  const user = await User.findOne({ email, isArchived: false })
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
    isArchived: false,
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
  const user = await User.findOne({ _id: req.user._id, isArchived: false })
    .populate("roleId")
    .populate("venueId");

  if (!user) {
    throw new ApiError("User not found", 404);
  }

  // Get user permissions
  const permissions = await user.getPermissions();
  const populatedPermissions = await Permission.find({
    _id: { $in: permissions },
    isArchived: false,
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

  const user = await User.findOne({ _id: req.user._id, isArchived: false });

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

  const user = await User.findOne({ _id: req.user._id, isArchived: false }).select("+password");

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

  const user = await User.findOne({ email, isArchived: false });

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

  // Find user by token (only non-archived users)
  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpire: { $gt: Date.now() },
    isArchived: false,
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
 * @desc    Archive user account (soft delete)
 * @route   PATCH /api/v1/auth/archive
 * @access  Private
 */
export const archiveAccount = asyncHandler(async (req, res) => {
  const user = await User.findOne({ _id: req.user._id, isArchived: false });

  if (!user) {
    throw new ApiError("User not found", 404);
  }

  // Archive the user
  user.isArchived = true;
  user.archivedAt = new Date();
  user.archivedBy = req.user._id;
  
  await user.save();

  new ApiResponse(
    null,
    "Your account has been archived successfully"
  ).send(res);
});

/**
 * @desc    Restore archived user account
 * @route   PATCH /api/v1/auth/restore
 * @access  Public
 */
export const restoreAccount = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email, isArchived: true });

  if (!user) {
    throw new ApiError("No archived account found with this email", 404);
  }

  // Restore the user
  user.isArchived = false;
  user.archivedAt = undefined;
  user.archivedBy = undefined;
  
  await user.save();

  new ApiResponse(
    {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    },
    "Account restored successfully"
  ).send(res);
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

/**
 * @desc    Get user statistics
 * @route   GET /api/v1/auth/stats
 * @access  Private
 */
export const getUserStats = asyncHandler(async (req, res) => {
  const venueId = req.user.venueId;

  const stats = await User.aggregate([
    {
      $match: {
        venueId: new mongoose.Types.ObjectId(venueId),
      },
    },
    {
      $group: {
        _id: "$isArchived",
        total: { $sum: 1 },
        active: {
          $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] },
        },
        inactive: {
          $sum: { $cond: [{ $eq: ["$isActive", false] }, 1, 0] },
        },
      },
    },
  ]);

  const archivedStats = stats.find(stat => stat._id === true) || { total: 0, active: 0, inactive: 0 };
  const activeStats = stats.find(stat => stat._id === false) || { total: 0, active: 0, inactive: 0 };

  new ApiResponse({
    activeUsers: activeStats.total,
    archivedUsers: archivedStats.total,
    activeCount: activeStats.active,
    inactiveCount: activeStats.inactive,
    totalUsers: activeStats.total + archivedStats.total,
  }).send(res);
});