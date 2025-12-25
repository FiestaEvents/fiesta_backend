import mongoose from "mongoose";
import asyncHandler from "./asyncHandler.js";
import ApiError from "../utils/ApiError.js";

/**
 * Check if user has required permission
 * Optimized: Uses the permissionsList calculated in authMiddleware
 */
export const checkPermission = (permissionName) => {
  return (req, res, next) => {
    // 1. Ensure Auth Middleware ran
    if (!req.user) {
      return next(new ApiError("Unauthorized - User context missing", 401));
    }

    // 2. SUPER ADMIN / OWNER OVERRIDE
    // If user is Owner, bypass all checks
    if (
      req.user.isSuperAdmin ||
      req.user.roleType === "owner" ||
      (req.user.roleId && req.user.roleId.name === "Owner")
    ) {
      return next();
    }

    // 3. Check calculated permissions list (Ensure user.getPermissions() was called or stored)
    // Note: ensure your auth middleware attaches this list, or check req.user.hasPermission logic
    if (req.user.permissionsList && req.user.permissionsList.includes(permissionName)) {
      return next();
    }
    
    // Fallback: Check using the method if list isn't pre-calculated
    // (This requires the method to be synchronous or handled differently, 
    // but typically auth middleware should prep this)
    
    // 4. Permission Denied
    return next(new ApiError(
      `You don't have permission to perform this action (${permissionName})`,
      403
    ));
  };
};

/**
 * Check ownership of a resource
 * Usage: router.put('/:id', checkOwnership('Event'), updateEvent);
 */
export const checkOwnership = (modelName, userField = "createdBy") => {
  return asyncHandler(async (req, res, next) => {
    // 1. Load Model Dynamically via Mongoose Registry
    // In ESM, we rely on the fact that models are registered in index.js at app startup
    let Model;
    try {
      Model = mongoose.model(modelName);
    } catch (e) {
      throw new ApiError(`Model ${modelName} not found in Mongoose registry`, 500);
    }
    
    // 2. Find Resource
    const resource = await Model.findById(req.params.id);

    if (!resource) {
      throw new ApiError(`${modelName} not found`, 404);
    }

    // 3. Ownership Logic
    const ownerId = resource[userField] ? resource[userField].toString() : null;
    const currentUserId = req.user._id.toString();
    
    const isOwner = ownerId === currentUserId;

    // 4. Permission Check
    if (!isOwner) {
       const moduleName = modelName.toLowerCase() + 's'; 
       const globalPermission = `${moduleName}.update.all`; 

       // Check global permission if not owner
       const hasGlobalPerm = req.user.permissionsList 
          ? req.user.permissionsList.includes(globalPermission)
          : false;

       if (
         !req.user.isSuperAdmin &&
         req.user.roleType !== "owner" && 
         !hasGlobalPerm
       ) {
         throw new ApiError("You can only access your own resources", 403);
       }
    }

    // Attach resource to request to avoid re-fetching
    req.resource = resource;
    next();
  });
};

/**
 * Check Role Hierarchy
 * Prevents a Manager (Lvl 75) from deleting an Owner (Lvl 100)
 */
export const checkRoleLevel = (minLevel) => {
  return (req, res, next) => {
    if (!req.user?.roleId) {
      return next(new ApiError("Unauthorized - No Role assigned", 401));
    }

    if (req.user.roleId.level < minLevel) {
      return next(new ApiError("Insufficient role level for this action", 403));
    }

    next();
  };
};