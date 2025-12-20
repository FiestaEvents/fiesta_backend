import asyncHandler from "./asyncHandler.js";
import ApiError from "../utils/ApiError.js";

/**
 * Check if user has required permission
 * Optimized: Uses the permissionsList calculated in auth.js
 */
export const checkPermission = (permissionName) => {
  return (req, res, next) => {
    // 1. Ensure Auth Middleware ran
    if (!req.user) {
      throw new ApiError("Unauthorized - User context missing", 401);
    }

    // 2. SUPER ADMIN / OWNER OVERRIDE
    // If user is Owner, bypass all checks
    if (
      req.user.roleType === "owner" ||
      req.user.roleId?.name === "Owner"
    ) {
      return next();
    }

    // 3. Check calculated permissions list
    // This is synchronous and fast (no DB call)
    if (req.user.permissionsList.includes(permissionName)) {
      return next();
    }

    // 4. Permission Denied
    throw new ApiError(
      `You don't have permission to perform this action (${permissionName})`,
      403
    );
  };
};

/**
 * Check ownership of a resource
 * This usually still requires a DB call to fetch the resource to see who owns it
 */
export const checkOwnership = (modelName, userField = "createdBy") => {
  return asyncHandler(async (req, res, next) => {
    // Dynamic Import to avoid circular dependencies
    // Assuming models are exported as default from their files
    const Model = (await import(`../models/${modelName}.js`)).default;
    
    const resource = await Model.findById(req.params.id);

    if (!resource) {
      throw new ApiError(`${modelName} not found`, 404);
    }

    // 1. Check if user is the creator/owner of the resource
    const isOwner = resource[userField]?.toString() === req.user._id.toString();

    // 2. Check if user has the "Global Update" permission (e.g., events.update.all)
    //    If they are not the owner, they need the ".all" permission.
    //    If they are the owner, they likely passed the previous route permission check (.own)
    
    // NOTE: Usually, the route handles the general permission (e.g. events.update.own). 
    // This middleware specifically enforces that IF you only have .own, you better be the owner.

    if (!isOwner) {
       // Check if they have the global override permission
       const globalPermission = `${modelName.toLowerCase()}s.update.all`; // heuristic
       if (
         req.user.roleType !== "owner" && 
         !req.user.permissionsList.includes(globalPermission)
       ) {
         throw new ApiError("You can only access your own resources", 403);
       }
    }

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
      throw new ApiError("Unauthorized", 401);
    }

    if (req.user.roleId.level < minLevel) {
      throw new ApiError("Insufficient role level for this action", 403);
    }

    next();
  };
};