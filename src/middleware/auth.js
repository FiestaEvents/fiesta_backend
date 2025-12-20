import jwt from "jsonwebtoken";
import asyncHandler from "./asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import User from "../models/User.js";
import config from "../config/env.js";

export const authenticate = asyncHandler(async (req, res, next) => {
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
    const decoded = jwt.verify(token, config.jwt.secret);

    // 3. Fetch User with DEEP POPULATION
    // We populate Role -> Permissions, plus Custom Permissions
    const user = await User.findById(decoded.id)
      .populate({
        path: "roleId",
        populate: {
          path: "permissions",
          model: "Permission",
        },
      })
      .populate("customPermissions.granted")
      .populate("customPermissions.revoked")
      .select("-password");

    if (!user) {
      throw new ApiError("User not found", 404);
    }

    if (!user.isActive) {
      throw new ApiError("User account is inactive", 403);
    }

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
    req.venue = user.venueId; // Helper for venue-scoped queries

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

// Helper to ensure venue exists attached (if needed separately)
export const attachVenue = asyncHandler(async (req, res, next) => {
  if (req.user && req.user.venueId) {
    req.venue = req.user.venueId;
  }
  next();
});
