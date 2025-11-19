import jwt from "jsonwebtoken";
import asyncHandler from "./asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { User } from "../models/index.js";
import config from "../config/env.js";

export const authenticate = asyncHandler(async (req, res, next) => {
  let token;
  
  // Get token from header
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }
  
  // Check if token exists
  if (!token) {
    throw new ApiError("Not authorized to access this route", 401);
  }
  
  try {
    // Verify token
    const decoded = jwt.verify(token, config.jwt.secret);
    
    // Get user from token
    // ✅ FIXED: Removed .populate("venueId") to keep it as ObjectId
    req.user = await User.findById(decoded.id)
      .populate("roleId");
      // venueId will remain as ObjectId, not populated
    
    if (!req.user) {
      throw new ApiError("User not found", 404);
    }
    
    if (!req.user.isActive) {
      throw new ApiError("User account is inactive", 403);
    }
    
    next();
  } catch (error) {
    throw new ApiError("Not authorized to access this route", 401);
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
// ✅ UPDATED: Now fetches venue when needed instead of using populated data
export const attachVenue = asyncHandler(async (req, res, next) => {
  if (req.user && req.user.venueId) {
    // If you need the full venue object somewhere, fetch it here
    // const Venue = mongoose.model('Venue');
    // req.venue = await Venue.findById(req.user.venueId);
    
    // For now, just attach the venueId
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