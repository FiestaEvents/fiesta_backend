// src/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const asyncHandler = require('./asyncHandler');
const ApiError = require('../utils/ApiError');
const User = require('../models/User');
const Business = require('../models/Business');
// Assuming config is exported via CommonJS as well
// If strict ES modules are used in config, you might need require('../config/env').default
const config = require('../config/env'); 

exports.authenticate = asyncHandler(async (req, res, next) => {
  let token;

  // 1. Extract Token
  // Priority: Check HttpOnly Cookie first (Secure)
  if (req.cookies && req.cookies.jwt) {
    token = req.cookies.jwt;
  }
  // Fallback: Check Authorization Header (For Postman/Testing)
  else if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    throw new ApiError("Not authorized to access this route", 401);
  }

  try {
    // 2. Verify Token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || config.jwt.secret);

    // 3. Fetch User with DEEP POPULATION
    // We populate Role -> Permissions, plus Custom Permissions
    const user = await User.findById(decoded.id)
      .populate({
        path: "roleId",
        populate: { path: "permissions", model: "Permission" },
      })
      // ARCHITECTURE UPDATE: Populate Business instead of Venue
      .populate("businessId") 
      .populate("customPermissions.granted")
      .populate("customPermissions.revoked")
      .select("-password");

    if (!user) throw new ApiError("User not found", 404);

    // Optional: Check Subscription Status
    // if (user.businessId && user.businessId.subscription?.status !== "active") {
    //    throw new ApiError("Subscription inactive. Please upgrade.", 402);
    // }

    // 4. Calculate Effective Permissions ONCE
    let effectivePermissions = [];

    // A. Start with Role Permissions
    if (user.roleId && user.roleId.permissions) {
      effectivePermissions = user.roleId.permissions.map((p) => p.name);
    }

    // B. Add Custom Granted Permissions
    if (user.customPermissions?.granted?.length > 0) {
      const grantedNames = user.customPermissions.granted.map((p) => p.name);
      effectivePermissions = [...effectivePermissions, ...grantedNames];
    }

    // C. Remove Custom Revoked Permissions
    if (user.customPermissions?.revoked?.length > 0) {
      const revokedNames = user.customPermissions.revoked.map((p) => p.name);
      effectivePermissions = effectivePermissions.filter(
        (perm) => !revokedNames.includes(perm)
      );
    }

    // Attach calculated data to request
    req.user = user;
    req.user.permissionsList = [...new Set(effectivePermissions)]; // Unique array
    
    // ATTACH BUSINESS CONTEXT
    // This replaces the old req.venue
    req.business = user.businessId; 

    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      throw new ApiError("Invalid token", 401);
    } else if (error.name === "TokenExpiredError") {
      throw new ApiError("Token expired", 401);
    }
    throw error;
  }
});

exports.authorizeSuperAdmin = (req, res, next) => {
  if (req.user && req.user.isSuperAdmin) {
    next();
  } else {
    // Using ApiError for consistency instead of raw res.status
    next(new ApiError("Not authorized as Super Admin", 403));
  }
};

// Enforces that the user belongs to a business
// Use this for routes that require business data (e.g. creating events)
exports.requireBusiness = asyncHandler(async (req, res, next) => {
  if (!req.business && !req.user.isSuperAdmin) {
    throw new ApiError("User is not associated with any Business.", 403);
  }
  next();
});