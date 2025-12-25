import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import asyncHandler from "./asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { User } from "../models/index.js";
import config from "../config/env.js";

/**
 * Protect routes - Verify JWT and load User & Business Context
 */
export const authenticate = asyncHandler(async (req, res, next) => {
  let token;

  // 1. Get token
  if (req.cookies && req.cookies.jwt) {
    token = req.cookies.jwt;
  } else if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    throw new ApiError("Not authorized to access this route. Please login.", 401);
  }

  try {
    // 2. Verify token
    const decoded = jwt.verify(token, config.jwt.secret);

    // 3. Find User with DEEP POPULATION
    // We need permissions for RBAC and businessId for Tenant Isolation
    const user = await User.findById(decoded.id)
      .populate({
        path: "roleId",
        populate: { path: "permissions", model: "Permission" },
      })
      .populate("businessId") // ✅ Critical: Populates the full Business object
      .populate("customPermissions.granted")
      .populate("customPermissions.revoked");

    if (!user) {
      throw new ApiError("The user belonging to this token no longer exists.", 401);
    }

    if (!user.isActive || user.isArchived) {
      throw new ApiError("User account is inactive or archived.", 403);
    }

    // 4. Calculate Effective Permissions
    let effectivePermissions = [];

    // A. Role Permissions
    if (user.roleId && user.roleId.permissions) {
      // Handle case where permissions might be objects or just IDs
      effectivePermissions = user.roleId.permissions.map((p) => p.name || p);
    }

    // B. Custom Granted
    if (user.customPermissions?.granted?.length > 0) {
      const grantedNames = user.customPermissions.granted.map((p) => p.name || p);
      effectivePermissions = [...effectivePermissions, ...grantedNames];
    }

    // C. Custom Revoked
    if (user.customPermissions?.revoked?.length > 0) {
      const revokedNames = user.customPermissions.revoked.map((p) => p.name || p);
      effectivePermissions = effectivePermissions.filter(
        (perm) => !revokedNames.includes(perm)
      );
    }

    // --- DEBUGGING LOGS (Remove in Production) ---
    // console.log("🔍 [Auth] User:", user.email);
    // console.log("🔍 [Auth] Business:", user.businessId ? user.businessId._id : "NULL");
    
    if (!user.businessId && !user.isSuperAdmin) {
       // Allow request to proceed but warn, or block specific routes later
       console.warn(`⚠️ Warning: User ${user.email} has no Business linked.`);
    }
    // ---------------------------------------------

    // 5. Attach Context to Request
    req.user = user;
    req.user.permissionsList = [...new Set(effectivePermissions)]; // Unique array
    
    // ✅ This fixes "Cannot read properties of undefined (reading '_id')"
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

export const authorizeSuperAdmin = (req, res, next) => {
  if (req.user && req.user.isSuperAdmin) {
    next();
  } else {
    throw new ApiError("Not authorized as Super Admin", 403);
  }
};