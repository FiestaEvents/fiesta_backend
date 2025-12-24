// src/controllers/authController.js
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

// Middleware & Utils
const asyncHandler = require("../middleware/asyncHandler.js");
const ApiError = require("../utils/ApiError.js");
const ApiResponse = require("../utils/ApiResponse.js");
const config = require("../config/env.js");
const { generateToken } = require("../utils/tokenService.js");
const { sendWelcomeEmail, sendPasswordResetEmail } = require("../services/emailService.js");

// Models
// Note: Space replaces VenueSpace
const { User, Business, Role, Permission, Space } = require("../models/index.js"); 
const { PERMISSIONS } = require("../config/permissions.js");
const { DEFAULT_ROLES } = require("../config/roles.js");

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
      isSuperAdmin: user.isSuperAdmin,
      role: user.roleId
        ? {
            id: user.roleId._id,
            name: user.roleId.name,
            type: user.roleType,
            level: user.roleId.level,
          }
        : null,
      // Renamed from 'venue' to 'business'
      business: user.businessId
        ? {
            id: user.businessId._id,
            name: user.businessId.name,
            category: user.businessId.category,
            subscription: user.businessId.subscription
          }
        : null,
      permissions: getPermissionsList(user),
    },
  };
};

/**
 * Background Task: Initialize Business Data (Roles, Permissions, Defaults)
 */
const completeBusinessSetupAsync = async ({
  businessId,
  userId,
  category,
  spaces, // Optional: Only for Venues
  userEmail,
  userName,
  businessName,
}) => {
  try {
    // 1. Seed System Permissions (if missing)
    // In a real prod environment, this might be a separate migration script
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

    // 2. Create Default Roles for THIS Business
    // TODO: Filter DEFAULT_ROLES based on category (e.g., Drivers don't need 'Chef')
    const rolePromises = DEFAULT_ROLES.map(async (roleConfig) => {
      if (roleConfig.name === "Owner") return null; // Already created in register
      
      const permissionIds = roleConfig.permissions === "ALL"
        ? allPermissions.map((p) => p._id)
        : roleConfig.permissions
            .map((name) => permissionMap[name])
            .filter(Boolean);

      return Role.create({
        ...roleConfig,
        permissions: permissionIds,
        businessId, // Linked to the new business
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

    // 4. Create Venue Spaces (Only if category is 'venue')
    if (category === 'venue' && spaces?.length > 0) {
      const spaceDocs = spaces.map((space) => ({
        name: space.name,
        type: 'room', // Explicit type
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
    
    // Future: If category === 'driver', create default 'Vehicle' resource?

    // 5. Send Welcome Email
    try {
      await sendWelcomeEmail({
        email: userEmail,
        userName,
        businessName, // Renamed param in email template
        category,
      });
    } catch (e) {
      console.error("Email service failed:", e.message);
    }

    console.log(`✅ Setup completed for business: ${businessName} (${category})`);
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
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email, isArchived: false })
    .select("+password")
    .populate("businessId") // Changed from venueId
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

  // Check Business Subscription
  if (user.businessId && user.businessId.subscription?.status !== "active") {
    // Optional: throw new ApiError("Business subscription is inactive", 403);
    // For now, usually we let them log in to PAY, but maybe restrict features.
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
exports.getCurrentUser = asyncHandler(async (req, res) => {
  let user = req.user;

  // Ensure deep population if middleware didn't provide it
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
exports.register = asyncHandler(async (req, res) => {
  const {
    // 1. User Info
    name,
    email,
    password,
    phone,
    
    // 2. Business Info
    businessName, // Renamed from venueName
    category = "venue", // 'venue', 'photography', 'driver', etc.
    description,
    
    // 3. Dynamic Details
    address,        // Common
    spaces = [],    // If Venue
    serviceRadius,  // If Service Provider
    pricingModel    // If Service Provider
  } = req.body;

  // Validation
  if (await User.findOne({ email, isArchived: false })) {
    throw new ApiError("Email already registered", 400);
  }

  // 1. Prepare Business Data (The "Chameleon" Logic)
  const businessData = {
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
    owner: null, // Linked later
    isArchived: false,
  };

  // Populate polymorphic sub-documents
  if (category === 'venue') {
    businessData.venueDetails = {
      capacity: { min: 0, max: 0 } // Defaults
      // spaces are added in async setup
    };
  } else {
    // It's a service provider (Photographer, Driver, etc.)
    businessData.serviceDetails = {
      serviceRadiusKM: serviceRadius || 50,
      pricingModel: pricingModel || 'fixed'
    };
  }

  // 2. Create Business
  const business = await Business.create(businessData);

  // 3. Create Owner Role
  const ownerRole = await Role.create({
    name: "Owner",
    description: "Business owner with full permissions",
    level: 100,
    permissions: [], // Populated async
    businessId: business._id, // Renamed from venueId
    isSystemRole: true,
    isArchived: false,
  });

  // 4. Create User
  const user = await User.create({
    name,
    email,
    password,
    phone,
    roleId: ownerRole._id,
    roleType: "owner",
    businessId: business._id, // Renamed from venueId
    isArchived: false,
  });

  // 5. Link Owner to Business
  business.owner = user._id;
  await business.save();

  // 6. Set Cookie & Response
  const token = generateToken(user._id);
  res.cookie("jwt", token, getCookieOptions());

  // Construct initial response
  const initialResponse = {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: { id: ownerRole._id, name: "Owner", type: "owner", level: 100 },
      business: { 
        id: business._id, 
        name: business.name, 
        category: business.category 
      },
      permissions: [], 
    },
    setupStatus: "in_progress",
  };

  new ApiResponse(initialResponse, "Registration successful", 201).send(res);

  // 7. Trigger Background Setup
  completeBusinessSetupAsync({
    businessId: business._id,
    userId: user._id,
    category,
    spaces,       // Passed if venue
    userEmail: email,
    userName: name,
    businessName,
  });
});

/**
 * @desc    Logout user & clear cookie
 * @route   POST /api/v1/auth/logout
 */
exports.logout = asyncHandler(async (req, res) => {
  res.cookie("jwt", "loggedout", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });
  new ApiResponse(null, "Logout successful").send(res);
});

// =============================================================================
// 👤 PROFILE & ACCOUNT MANAGEMENT
// =============================================================================

exports.verifyEmail = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email, isArchived: false });
  if (user) throw new ApiError("Email is already taken", 401);
  return res.status(200).send({ message: "Email is available" });
});

exports.updateProfile = asyncHandler(async (req, res) => {
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

exports.changePassword = asyncHandler(async (req, res) => {
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

exports.forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email, isArchived: false });

  if (!user) {
    // Standard security practice: Don't reveal if email exists
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

exports.resetPassword = asyncHandler(async (req, res) => {
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

exports.archiveAccount = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) throw new ApiError("User not found", 404);

  user.isArchived = true;
  user.archivedAt = new Date();
  await user.save();

  new ApiResponse(null, "Account archived").send(res);
});

exports.restoreAccount = asyncHandler(async (req, res) => {
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
exports.getUserStats = asyncHandler(async (req, res) => {
  // Updated to use businessId
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