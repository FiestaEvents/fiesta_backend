import asyncHandler from "../middleware/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { Role, Permission, User } from "../models/index.js";

/**
 * @desc    Get all roles
 * @route   GET /api/v1/roles
 * @access  Private (roles.read.all)
 */
export const getRoles = asyncHandler(async (req, res) => {
  const roles = await Role.find({
    venueId: req.user.venueId,
    isActive: true,
  })
    .populate("permissions")
    .populate("createdBy", "name email")
    .sort({ level: -1 });

  // Get user count for each role
  const rolesWithUserCount = await Promise.all(
    roles.map(async (role) => {
      const userCount = await User.countDocuments({ roleId: role._id });
      return {
        ...role.toObject(),
        userCount,
      };
    })
  );

  new ApiResponse({ roles: rolesWithUserCount }).send(res);
});

/**
 * @desc    Get single role
 * @route   GET /api/v1/roles/:id
 * @access  Private (roles.read.all)
 */
export const getRole = asyncHandler(async (req, res) => {
  const role = await Role.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  })
    .populate("permissions")
    .populate("createdBy", "name email");

  if (!role) {
    throw new ApiError("Role not found", 404);
  }

  // Get users with this role
  const users = await User.find({ roleId: role._id })
    .select("name email avatar")
    .limit(10);

  new ApiResponse({
    role: {
      ...role.toObject(),
      users,
    },
  }).send(res);
});

/**
 * @desc    Create new role
 * @route   POST /api/v1/roles
 * @access  Private (roles.create)
 */
export const createRole = asyncHandler(async (req, res) => {
  const { name, description, permissionIds, level } = req.body;

  // Check if role name already exists in this venue
  const existingRole = await Role.findOne({
    name,
    venueId: req.user.venueId,
  });

  if (existingRole) {
    throw new ApiError("Role with this name already exists", 400);
  }

  // Verify all permissions exist
  const permissions = await Permission.find({
    _id: { $in: permissionIds },
  });

  if (permissions.length !== permissionIds.length) {
    throw new ApiError("Some permissions are invalid", 400);
  }

  const role = await Role.create({
    name,
    description,
    permissions: permissionIds,
    level: level || 50,
    venueId: req.user.venueId,
    createdBy: req.user._id,
    isSystemRole: false,
  });

  await role.populate("permissions");

  new ApiResponse({ role }, "Role created successfully", 201).send(res);
});

/**
 * @desc    Update role
 * @route   PUT /api/v1/roles/:id
 * @access  Private (roles.update.all)
 */
export const updateRole = asyncHandler(async (req, res) => {
  const { name, description, permissionIds, level, isActive } = req.body;

  const role = await Role.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  });

  if (!role) {
    throw new ApiError("Role not found", 404);
  }

  if (role.isSystemRole) {
    throw new ApiError("Cannot modify system roles", 400);
  }

  // Check if new name conflicts with existing role
  if (name && name !== role.name) {
    const existingRole = await Role.findOne({
      name,
      venueId: req.user.venueId,
      _id: { $ne: role._id },
    });

    if (existingRole) {
      throw new ApiError("Role with this name already exists", 400);
    }
  }

  // Verify permissions if being updated
  if (permissionIds) {
    const permissions = await Permission.find({
      _id: { $in: permissionIds },
    });

    if (permissions.length !== permissionIds.length) {
      throw new ApiError("Some permissions are invalid", 400);
    }
  }

  // Update fields
  if (name) role.name = name;
  if (description) role.description = description;
  if (permissionIds) role.permissions = permissionIds;
  if (level !== undefined) role.level = level;
  if (isActive !== undefined) role.isActive = isActive;

  await role.save();
  await role.populate("permissions");

  new ApiResponse({ role }, "Role updated successfully").send(res);
});

/**
 * @desc    Delete role
 * @route   DELETE /api/v1/roles/:id
 * @access  Private (roles.delete.all)
 */
export const deleteRole = asyncHandler(async (req, res) => {
  const role = await Role.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  });

  if (!role) {
    throw new ApiError("Role not found", 404);
  }

  if (role.isSystemRole) {
    throw new ApiError("Cannot delete system roles", 400);
  }

  // Check if any users have this role
  const usersWithRole = await User.countDocuments({ roleId: role._id });

  if (usersWithRole > 0) {
    throw new ApiError(
      `Cannot delete role. ${usersWithRole} user(s) are assigned to this role.`,
      400
    );
  }

  await role.deleteOne();

  new ApiResponse(null, "Role deleted successfully").send(res);
});

/**
 * @desc    Get all permissions
 * @route   GET /api/v1/roles/permissions
 * @access  Private (roles.read.all)
 */
export const getPermissions = asyncHandler(async (req, res) => {
  const permissions = await Permission.find({ isActive: true }).sort({
    module: 1,
    action: 1,
  });

  // Group by module
  const groupedPermissions = permissions.reduce((acc, perm) => {
    if (!acc[perm.module]) {
      acc[perm.module] = [];
    }
    acc[perm.module].push(perm);
    return acc;
  }, {});

  new ApiResponse({
    permissions,
    grouped: groupedPermissions,
  }).send(res);
});