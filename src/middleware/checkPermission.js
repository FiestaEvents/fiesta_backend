import asyncHandler from "./asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { Permission } from "../models/index.js";

/**
 * Check if user has required permission
 */
export const checkPermission = (permissionName) => {
  return asyncHandler(async (req, res, next) => {
    if (!req.user) {
      throw new ApiError("Unauthorized", 401);
    }

    // Owner has all permissions
    if (req.user.roleType === "owner") {
      return next();
    }

    // Check if user has the permission
    const hasPermission = await req.user.hasPermission(permissionName);

    if (!hasPermission) {
      throw new ApiError(
        `You don't have permission to perform this action (${permissionName})`,
        403
      );
    }

    next();
  });
};

/**
 * Check if user's role level meets minimum required level
 */
export const checkRoleLevel = (minLevel) => {
  return asyncHandler(async (req, res, next) => {
    if (!req.user || !req.user.roleId) {
      throw new ApiError("Unauthorized", 401);
    }

    if (req.user.roleId.level < minLevel) {
      throw new ApiError("Insufficient role level for this action", 403);
    }

    next();
  });
};

/**
 * Check if user belongs to the same venue as the resource
 */
export const checkVenueAccess = asyncHandler(async (req, res, next) => {
  // Extract venueId from request
  const resourceVenueId =
    req.params.venueId || req.body.venueId || req.query.venueId;

  if (resourceVenueId && req.user.venueId._id.toString() !== resourceVenueId.toString()) {
    throw new ApiError("You don't have access to this venue's resources", 403);
  }

  next();
});

/**
 * Check ownership of a resource (for scope: "own" permissions)
 */
export const checkOwnership = (model, userField = "createdBy") => {
  return asyncHandler(async (req, res, next) => {
    const Model = require(`../models/${model}.js`).default;
    const resource = await Model.findById(req.params.id);

    if (!resource) {
      throw new ApiError(`${model} not found`, 404);
    }

    // Check if user created this resource
    if (resource[userField].toString() !== req.user._id.toString()) {
      // Check if user has "all" scope permission
      const permissionName = `${model.toLowerCase()}s.update.all`;
      const hasAllPermission = await req.user.hasPermission(permissionName);

      if (!hasAllPermission) {
        throw new ApiError("You can only access your own resources", 403);
      }
    }

    req.resource = resource;
    next();
  });
};