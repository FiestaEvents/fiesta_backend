import { Role, Permission } from "../models/index.js";
import asyncHandler from "../middleware/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";

/**
 * Helper to safely get Business ID string
 * Refactored from getVenueId for Chameleon Architecture
 */
const getBusinessId = (user) => {
  if (!user || !user.businessId) return null;
  // If businessId is an object (populated), return its _id, otherwise return the value itself
  return user.businessId._id ? user.businessId._id : user.businessId;
};

/**
 * @desc    Get all roles for the current business
 * @route   GET /api/v1/roles
 */
export const getRoles = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search } = req.query;
  
  // ✅ FIX: Safely extract Business ID instead of Venue ID
  const businessId = getBusinessId(req.user);

  if (!businessId) {
    throw new ApiError("User is not associated with a business", 400);
  }

  const query = { 
    businessId, 
    isArchived: false 
  };

  if (search) {
    query.name = { $regex: search, $options: "i" };
  }

  // Debug Log
  console.log(`🔍 [GetRoles] Querying for BusinessID: ${businessId}`);

  const roles = await Role.find(query)
    .populate("permissions", "name displayName module action")
    .sort({ level: -1, createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  const total = await Role.countDocuments(query);

  new ApiResponse({ roles, total }, "Roles retrieved successfully").send(res);
});

/**
 * @desc    Get single role
 * @route   GET /api/v1/roles/:id
 */
export const getRole = asyncHandler(async (req, res) => {
  const businessId = getBusinessId(req.user);
  
  const role = await Role.findOne({ 
    _id: req.params.id, 
    businessId // Ensure role belongs to this business
  }).populate("permissions");

  if (!role) throw new ApiError("Role not found", 404);

  new ApiResponse({ role }).send(res);
});

/**
 * @desc    Create new role
 * @route   POST /api/v1/roles
 */
export const createRole = asyncHandler(async (req, res) => {
  const { name, description, permissionIds } = req.body;
  const businessId = getBusinessId(req.user);

  // Check uniqueness within the business scope
  const existingRole = await Role.findOne({ 
    name: { $regex: new RegExp(`^${name}$`, "i") }, 
    businessId, 
    isArchived: false 
  });
  
  if (existingRole) throw new ApiError("Role with this name already exists in your business", 400);

  const role = await Role.create({
    name,
    description,
    permissions: permissionIds,
    businessId, // Linked to generic Business entity
    level: 10, // Default custom level
    isSystemRole: false
  });

  new ApiResponse({ role }, "Role created successfully", 201).send(res);
});

/**
 * @desc    Update role
 * @route   PUT /api/v1/roles/:id
 */
export const updateRole = asyncHandler(async (req, res) => {
  const { name, description, permissionIds } = req.body;
  const businessId = getBusinessId(req.user);

  const role = await Role.findOne({ 
    _id: req.params.id, 
    businessId 
  });

  if (!role) throw new ApiError("Role not found", 404);

  // Allow updating permissions of system roles, but NOT their names
  if (role.isSystemRole && name && name !== role.name) {
     throw new ApiError("Cannot rename system roles", 403);
  }
  
  // Protect Owner role completely
  if (role.name === "Owner") {
     throw new ApiError("Cannot modify the Owner role", 403);
  }

  if (name) role.name = name;
  if (description) role.description = description;
  if (permissionIds) role.permissions = permissionIds;

  await role.save();

  // Return populated to update UI
  const updatedRole = await Role.findById(role._id).populate("permissions");

  new ApiResponse({ role: updatedRole }, "Role updated successfully").send(res);
});

/**
 * @desc    Delete role
 * @route   DELETE /api/v1/roles/:id
 */
export const deleteRole = asyncHandler(async (req, res) => {
  const businessId = getBusinessId(req.user);
  
  const role = await Role.findOne({ 
    _id: req.params.id, 
    businessId 
  });

  if (!role) throw new ApiError("Role not found", 404);
  if (role.isSystemRole) throw new ApiError("Cannot delete system roles", 403);

  // Check if users are assigned to this role
  const { User } = await import("../models/index.js"); // Dynamic import to avoid circular dependency
  
  // Note: user schema has roleId, businessId. 
  // We check if any active user in this business holds this role.
  const usersWithRole = await User.countDocuments({ 
    roleId: role._id, 
    businessId, // Extra safety check
    isArchived: false 
  });
  
  if (usersWithRole > 0) {
    throw new ApiError(`Cannot delete role. It is assigned to ${usersWithRole} users.`, 400);
  }

  // Soft delete
  role.isArchived = true;
  await role.save();

  new ApiResponse(null, "Role deleted successfully").send(res);
});

/**
 * @desc    Get permissions list
 * @route   GET /api/v1/roles/permissions
 * @note    Permissions are global system constants, not tenant-specific.
 */
export const getPermissions = asyncHandler(async (req, res) => {
  const permissions = await Permission.find({ isActive: true }).sort({ module: 1 });
  
  const grouped = permissions.reduce((acc, curr) => {
    if (!acc[curr.module]) acc[curr.module] = [];
    acc[curr.module].push(curr);
    return acc;
  }, {});

  new ApiResponse({ permissions: grouped, raw: permissions }).send(res);
});