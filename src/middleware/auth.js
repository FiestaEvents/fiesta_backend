// middleware/auth.js - FIXED VERSION WITH DEBUGGING
import jwt from "jsonwebtoken";
import asyncHandler from "./asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { User } from "../models/index.js";
import config from "../config/env.js";

export const authenticate = asyncHandler(async (req, res, next) => {
  console.log('🔒 [AUTH] Starting authentication...');
  
  let token;
  
  // Get token from header
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
    console.log('✅ [AUTH] Token found:', token ? 'YES' : 'NO');
  } else {
    console.log('❌ [AUTH] No authorization header or wrong format');
    console.log('Headers:', req.headers.authorization);
  }
  
  // Check if token exists
  if (!token) {
    console.log('❌ [AUTH] Token missing - throwing 401');
    throw new ApiError("Not authorized to access this route", 401);
  }
  
  try {
    // Verify token
    console.log('🔍 [AUTH] Verifying token...');
    const decoded = jwt.verify(token, config.jwt.secret);
    console.log('✅ [AUTH] Token verified, userId:', decoded.id);
    
    // Get user from token
    console.log('👤 [AUTH] Fetching user from database...');
    req.user = await User.findById(decoded.id)
      .populate("roleId")
      .select("-password"); // Don't send password
    
    if (!req.user) {
      console.log('❌ [AUTH] User not found in database');
      throw new ApiError("User not found", 404);
    }
    
    console.log('✅ [AUTH] User found:', req.user._id);
    console.log('✅ [AUTH] VenueId:', req.user.venueId);
    
    if (!req.user.isActive) {
      console.log('❌ [AUTH] User account is inactive');
      throw new ApiError("User account is inactive", 403);
    }
    
    console.log('✅ [AUTH] Authentication successful!');
    next();
  } catch (error) {
    console.error('❌ [AUTH] Error:', error.message);
    
    // Provide more specific error messages
    if (error.name === 'JsonWebTokenError') {
      throw new ApiError("Invalid token", 401);
    } else if (error.name === 'TokenExpiredError') {
      throw new ApiError("Token expired", 401);
    } else if (error instanceof ApiError) {
      throw error;
    } else {
      throw new ApiError("Not authorized to access this route", 401);
    }
  }
});

// Grant access to specific roles
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      throw new ApiError("Not authorized to access this route", 401);
    }
    
    // Check if user has one of the required roles
    const userRole = req.user.roleId?.name || req.user.role;
    
    if (!roles.includes(userRole)) {
      throw new ApiError(
        `User role ${userRole} is not authorized to access this route`,
        403
      );
    }
    
    next();
  };
};

// Check specific permissions
export const checkPermission = (permission) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        throw new ApiError("Not authorized to access this route", 401);
      }
      
      // Get user with populated role and permissions
      const user = await User.findById(req.user._id)
        .populate({
          path: "roleId",
          populate: {
            path: "permissions",
            model: "Permission"
          }
        });
      
      if (!user.roleId) {
        throw new ApiError("Role not found", 403);
      }
      
      // Check if role has the required permission
      const hasPermission = user.roleId.permissions.some(perm => 
        perm.name === permission && perm.isActive
      );
      
      if (!hasPermission) {
        throw new ApiError(`Not authorized - requires ${permission} permission`, 403);
      }
      
      next();
    } catch (error) {
      throw new ApiError("Server error in permission check", 500);
    }
  };
};

// Attach venue to request
export const attachVenue = asyncHandler(async (req, res, next) => {
  if (req.user && req.user.venueId) {
    req.venue = req.user.venueId;
  }
  next();
});

// Optional: Combine authenticate and authorize in one middleware
export const protect = (roles = []) => {
  return [
    authenticate,
    ...(roles.length > 0 ? [authorize(...roles)] : [])
  ];
};