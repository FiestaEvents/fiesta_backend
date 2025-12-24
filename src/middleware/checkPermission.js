// src/middleware/permissionMiddleware.js
const mongoose = require('mongoose');
const asyncHandler = require('./asyncHandler');
const ApiError = require('../utils/ApiError');

/**
 * Check if user has required permission
 * Optimized: Uses the permissionsList calculated in authMiddleware
 */
exports.checkPermission = (permissionName) => {
  return (req, res, next) => {
    // 1. Ensure Auth Middleware ran
    if (!req.user) {
      // Pass error to next() instead of throwing synchronously to ensure Express catches it
      return next(new ApiError("Unauthorized - User context missing", 401));
    }

    // 2. SUPER ADMIN / OWNER OVERRIDE
    // If user is Owner, bypass all checks
    // We check both the string Role Name and the enum Role Type for robustness
    if (
      req.user.isSuperAdmin ||
      req.user.roleType === "owner" ||
      (req.user.roleId && req.user.roleId.name === "Owner")
    ) {
      return next();
    }

    // 3. Check calculated permissions list
    // This is synchronous and fast (no DB call)
    if (req.user.permissionsList && req.user.permissionsList.includes(permissionName)) {
      return next();
    }

    // 4. Permission Denied
    return next(new ApiError(
      `You don't have permission to perform this action (${permissionName})`,
      403
    ));
  };
};

/**
 * Check ownership of a resource
 * This usually still requires a DB call to fetch the resource to see who owns it
 * 
 * Usage: router.put('/:id', checkOwnership('Event'), updateEvent);
 */
exports.checkOwnership = (modelName, userField = "createdBy") => {
  return asyncHandler(async (req, res, next) => {
    // 1. Load Model Dynamically
    // Attempt to get from Mongoose registry first (safer), fallback to require
    let Model;
    try {
      Model = mongoose.model(modelName);
    } catch (e) {
      // Fallback: Try to require file directly if model not yet compiled
      try {
        Model = require(`../models/${modelName}`);
      } catch (err) {
        throw new ApiError(`Model ${modelName} not found`, 500);
      }
    }
    
    // 2. Find Resource
    const resource = await Model.findById(req.params.id);

    if (!resource) {
      throw new ApiError(`${modelName} not found`, 404);
    }

    // 3. Ownership Logic
    // Check if user is the creator/owner of the resource
    // userField is usually 'createdBy' or 'owner'
    const ownerId = resource[userField] ? resource[userField].toString() : null;
    const currentUserId = req.user._id.toString();
    
    const isOwner = ownerId === currentUserId;

    // 4. Permission Check
    // If they are NOT the owner, they need the "Global" permission (e.g. events.update.all)
    // If they ARE the owner, they likely passed the route permission check (e.g. events.update.own)
    
    if (!isOwner) {
       // Heuristic: Construct the "all" permission string (e.g. "Event" -> "events.update.all")
       // This assumes standard naming conventions. 
       const moduleName = modelName.toLowerCase() + 's'; 
       const globalPermission = `${moduleName}.update.all`; 

       if (
         !req.user.isSuperAdmin &&
         req.user.roleType !== "owner" && 
         !req.user.permissionsList.includes(globalPermission)
       ) {
         throw new ApiError("You can only access your own resources", 403);
       }
    }

    // Attach resource to request to avoid re-fetching in controller
    req.resource = resource;
    next();
  });
};

/**
 * Check Role Hierarchy
 * Prevents a Manager (Lvl 75) from deleting an Owner (Lvl 100)
 */
exports.checkRoleLevel = (minLevel) => {
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