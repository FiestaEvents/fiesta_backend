import asyncHandler from "../middleware/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { User, Business, Role, Permission, ActivityLog } from "../models/index.js";
import mongoose from "mongoose";

/**
 * Helper to safely get Business ID string
 */
const getBusinessId = (user) => {
  if (!user || !user.businessId) return null;
  return user.businessId._id ? user.businessId._id : user.businessId;
};

// Helper to log activity (stub if not imported)
const logActivity = async (userId, businessId, action, details) => {
    try {
        if(ActivityLog) {
             await ActivityLog.create({
                userId,
                businessId,
                action,
                details,
                timestamp: new Date()
            });
        }
    } catch (e) {
        console.error("Failed to log activity", e);
    }
};

/**
 * @desc    Get all users with filtering and pagination
 * @route   GET /api/v1/users
 * @access  Private (users:read:team)
 */
export const getUsers = asyncHandler(async (req, res) => {
  const {
    search,
    role,
    status,
    isArchived = false, // Default to non-archived users
    page = 1,
    limit = 10,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query;

  const businessId = getBusinessId(req.user);
  const query = { businessId, isArchived: isArchived === "true" };

  // Search filter
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
    ];
  }

  // Role filter
  if (role) {
    const roleDoc = await Role.findOne({
      name: role,
      businessId,
      isArchived: false,
    });
    if (roleDoc) {
      query.roleId = roleDoc._id;
    }
  }

  // Status filter
  if (status) {
    query.isActive = status === "active";
  }

  // Pagination options
  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
    sort: { [sortBy]: sortOrder === "desc" ? -1 : 1 },
    populate: [
      { path: "roleId", select: "name level" },
      { path: "invitedBy", select: "name email" },
    ],
  };

  // Execute query with pagination
  const users = await User.find(query)
    .select("-password")
    .limit(options.limit * 1)
    .skip((options.page - 1) * options.limit)
    .sort(options.sort)
    .populate(options.populate);

  const total = await User.countDocuments(query);

  new ApiResponse({
    users,
    pagination: {
      current: options.page,
      pages: Math.ceil(total / options.limit),
      total,
      limit: options.limit,
    },
    filters: {
      search,
      role,
      status,
      isArchived: query.isArchived,
    },
  }).send(res);
});

/**
 * @desc    Get archived users
 * @route   GET /api/v1/users/archived/list
 * @access  Private (users:read:team)
 */
export const getArchivedUsers = asyncHandler(async (req, res) => {
  const { search, page = 1, limit = 10 } = req.query;

  const businessId = getBusinessId(req.user);
  const query = { businessId, isArchived: true };

  // Search filter for archived users
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
    sort: { archivedAt: -1 },
    populate: [
      { path: "roleId", select: "name level" },
      { path: "archivedBy", select: "name email" },
    ],
  };

  const users = await User.find(query)
    .select("-password")
    .limit(options.limit * 1)
    .skip((options.page - 1) * options.limit)
    .sort(options.sort)
    .populate(options.populate);

  const total = await User.countDocuments(query);

  new ApiResponse({
    users,
    pagination: {
      current: options.page,
      pages: Math.ceil(total / options.limit),
      total,
      limit: options.limit,
    },
  }).send(res);
});

/**
 * @desc    Get single user by ID
 * @route   GET /api/v1/users/:id
 * @access  Private (users:read:team)
 */
export const getUserById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const businessId = getBusinessId(req.user);

  const user = await User.findOne({ _id: id, businessId })
    .select("-password")
    .populate("roleId")
    .populate("businessId")
    .populate("invitedBy", "name email")
    .populate("archivedBy", "name email");

  if (!user) {
    throw new ApiError("User not found", 404);
  }

  // Get user permissions
  const permissions = await user.getPermissions();
  const populatedPermissions = await Permission.find({
    _id: { $in: permissions },
    isArchived: false,
  });

  new ApiResponse({
    user: {
      ...user.toObject(),
      permissions: populatedPermissions.map((p) => ({
        id: p._id,
        name: p.name,
        displayName: p.displayName,
        module: p.module,
        action: p.action,
        scope: p.scope,
      })),
    },
  }).send(res);
});

/**
 * @desc    Create new user
 * @route   POST /api/v1/users
 * @access  Private (users:create:team)
 */
export const createUser = asyncHandler(async (req, res) => {
  const {
    name,
    email,
    password,
    phone,
    roleId,
    roleType = "staff",
    isActive = true,
  } = req.body;

  const businessId = getBusinessId(req.user);
  const invitedBy = req.user._id;

  // Check if user already exists (non-archived)
  const existingUser = await User.findOne({
    email,
    businessId,
    isArchived: false,
  });
  if (existingUser) {
    throw new ApiError("User with this email already exists", 400);
  }

  // Check if role exists and belongs to business
  const role = await Role.findOne({ _id: roleId, businessId, isArchived: false });
  if (!role) {
    throw new ApiError("Invalid role", 400);
  }

  // Create user
  const user = await User.create({
    name,
    email,
    password,
    phone,
    roleId,
    roleType,
    businessId,
    invitedBy,
    invitedAt: new Date(),
    isActive,
    isArchived: false,
  });

  // Populate user data for response
  await user.populate([
    { path: "roleId", select: "name level" },
    { path: "invitedBy", select: "name email" },
  ]);

  new ApiResponse(
    {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.roleId,
        roleType: user.roleType,
        isActive: user.isActive,
        invitedBy: user.invitedBy,
        invitedAt: user.invitedAt,
        createdAt: user.createdAt,
      },
    },
    "User created successfully",
    201
  ).send(res);
});

/**
 * @desc    Update user
 * @route   PUT /api/v1/users/:id
 * @access  Private (users:update:team)
 */
export const updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, phone, roleId, roleType, isActive, customPermissions } =
    req.body;

  const businessId = getBusinessId(req.user);

  // Find user (including archived users for restoration purposes)
  const user = await User.findOne({ _id: id, businessId });
  if (!user) {
    throw new ApiError("User not found", 404);
  }

  // Check if trying to update own account for certain fields
  if (id === req.user._id.toString()) {
    if (isActive !== undefined || roleId || roleType) {
      throw new ApiError("Cannot modify your own status or role", 400);
    }
  }

  // Update fields
  if (name) user.name = name;
  if (phone !== undefined) user.phone = phone;
  if (isActive !== undefined) user.isActive = isActive;

  // Update role if provided
  if (roleId) {
    const role = await Role.findOne({
      _id: roleId,
      businessId,
      isArchived: false,
    });
    if (!role) {
      throw new ApiError("Invalid role", 400);
    }
    user.roleId = roleId;
    if (roleType) user.roleType = roleType;
  }

  // Update custom permissions if provided
  if (customPermissions) {
    user.customPermissions = customPermissions;
  }

  await user.save();
  await logActivity(req.user._id, businessId, "update_member", `Updated member ${user.name} (Role/Status changed)`);
  
  // Populate updated user data
  await user.populate([
    { path: "roleId", select: "name level" },
    { path: "invitedBy", select: "name email" },
  ]);

  new ApiResponse(
    {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.roleId,
        roleType: user.roleType,
        isActive: user.isActive,
        customPermissions: user.customPermissions,
        lastLogin: user.lastLogin,
        updatedAt: user.updatedAt,
      },
    },
    "User updated successfully"
  ).send(res);
});

/**
 * @desc    Archive user (soft delete)
 * @route   PATCH /api/v1/users/:id/archive
 * @access  Private (users:delete:team)
 */
export const archiveUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const businessId = getBusinessId(req.user);
  const archivedBy = req.user._id;

  // Find active user
  const user = await User.findOne({ _id: id, businessId, isArchived: false });
  if (!user) {
    throw new ApiError("User not found or already archived", 404);
  }

  // Prevent self-archiving
  if (id === req.user._id.toString()) {
    throw new ApiError("Cannot archive your own account", 400);
  }

  // Prevent archiving business owner
  const business = await Business.findOne({ _id: businessId, owner: id });
  if (business) {
    throw new ApiError("Cannot archive business owner", 400);
  }

  // Archive the user
  user.isArchived = true;
  user.archivedAt = new Date();
  user.archivedBy = archivedBy;
  user.isActive = false; // Deactivate when archiving

  await user.save();

  new ApiResponse(
    {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isArchived: user.isArchived,
        archivedAt: user.archivedAt,
      },
    },
    "User archived successfully"
  ).send(res);
});

/**
 * @desc    Restore archived user
 * @route   PATCH /api/v1/users/:id/restore
 * @access  Private (users:update:team)
 */
export const restoreUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const businessId = getBusinessId(req.user);

  // Find archived user
  const user = await User.findOne({ _id: id, businessId, isArchived: true });
  if (!user) {
    throw new ApiError("Archived user not found", 404);
  }

  // Check if email is still unique among active users
  const existingUser = await User.findOne({
    email: user.email,
    businessId,
    isArchived: false,
    _id: { $ne: id },
  });

  if (existingUser) {
    throw new ApiError(
      "Cannot restore user. Another active user with this email already exists",
      400
    );
  }

  // Restore the user
  user.isArchived = false;
  user.archivedAt = undefined;
  user.archivedBy = undefined;
  user.isActive = true;

  await user.save();

  // Populate restored user data
  await user.populate([
    { path: "roleId", select: "name level" },
    { path: "invitedBy", select: "name email" },
  ]);

  new ApiResponse(
    {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.roleId,
        roleType: user.roleType,
        isActive: user.isActive,
        isArchived: user.isArchived,
        restoredAt: new Date(),
      },
    },
    "User restored successfully"
  ).send(res);
});

/**
 * @desc    Permanently delete user (only archived users)
 * @route   DELETE /api/v1/users/:id/permanent
 * @access  Private (users:delete:all)
 */
export const permanentDeleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const businessId = getBusinessId(req.user);

  // Find archived user
  const user = await User.findOne({ _id: id, businessId, isArchived: true });
  if (!user) {
    throw new ApiError("Archived user not found", 404);
  }

  // Prevent deleting business owner
  const business = await Business.findOne({ _id: businessId, owner: id });
  if (business) {
    throw new ApiError("Cannot permanently delete business owner", 400);
  }

  // Store user info for response before deletion
  const userInfo = {
    id: user._id,
    name: user.name,
    email: user.email,
  };

  // Permanent deletion
  await User.findByIdAndDelete(id);

  new ApiResponse(
    {
      deletedUser: userInfo,
    },
    "User permanently deleted"
  ).send(res);
});

/**
 * @desc    Bulk archive users
 * @route   PATCH /api/v1/users/bulk/archive
 * @access  Private (users:delete:team)
 */
export const bulkArchiveUsers = asyncHandler(async (req, res) => {
  const { userIds } = req.body;
  const businessId = getBusinessId(req.user);
  const archivedBy = req.user._id;

  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    throw new ApiError("User IDs array is required", 400);
  }

  // Prevent self-archiving
  if (userIds.includes(req.user._id.toString())) {
    throw new ApiError("Cannot archive your own account", 400);
  }

  // Check for business owner in the list
  const business = await Business.findOne({ _id: businessId, owner: { $in: userIds } });
  if (business) {
    throw new ApiError("Cannot archive business owner", 400);
  }

  // Archive users
  const result = await User.updateMany(
    {
      _id: { $in: userIds },
      businessId,
      isArchived: false,
    },
    {
      $set: {
        isArchived: true,
        archivedAt: new Date(),
        archivedBy: archivedBy,
        isActive: false,
      },
    }
  );

  new ApiResponse(
    {
      archivedCount: result.modifiedCount,
      totalSelected: userIds.length,
    },
    `${result.modifiedCount} users archived successfully`
  ).send(res);
});

/**
 * @desc    Bulk restore users
 * @route   PATCH /api/v1/users/bulk/restore
 * @access  Private (users:update:team)
 */
export const bulkRestoreUsers = asyncHandler(async (req, res) => {
  const { userIds } = req.body;
  const businessId = getBusinessId(req.user);

  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    throw new ApiError("User IDs array is required", 400);
  }

  // Restore users
  const result = await User.updateMany(
    {
      _id: { $in: userIds },
      businessId,
      isArchived: true,
    },
    {
      $set: {
        isArchived: false,
        isActive: true,
      },
      $unset: {
        archivedAt: 1,
        archivedBy: 1,
      },
    }
  );

  new ApiResponse(
    {
      restoredCount: result.modifiedCount,
      totalSelected: userIds.length,
    },
    `${result.modifiedCount} users restored successfully`
  ).send(res);
});

/**
 * @desc    Update user status
 * @route   PATCH /api/v1/users/:id/status
 * @access  Private (users:update:team)
 */
export const updateUserStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const businessId = getBusinessId(req.user);

  if (!["active", "inactive"].includes(status)) {
    throw new ApiError("Status must be either 'active' or 'inactive'", 400);
  }

  // Find user (non-archived only)
  const user = await User.findOne({ _id: id, businessId, isArchived: false });
  if (!user) {
    throw new ApiError("User not found", 404);
  }

  // Prevent self-deactivation
  if (id === req.user._id.toString() && status === "inactive") {
    throw new ApiError("Cannot deactivate your own account", 400);
  }

  user.isActive = status === "active";
  await user.save();

  new ApiResponse(
    {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isActive: user.isActive,
      },
    },
    `User ${status === "active" ? "activated" : "deactivated"} successfully`
  ).send(res);
});

/**
 * @desc    Update user role
 * @route   PATCH /api/v1/users/:id/role
 * @access  Private (users:update:team)
 */
export const updateUserRole = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { roleId } = req.body;
  const businessId = getBusinessId(req.user);

  // Find user (non-archived only)
  const user = await User.findOne({ _id: id, businessId, isArchived: false });
  if (!user) {
    throw new ApiError("User not found", 404);
  }

  // Check if role exists
  const role = await Role.findOne({ _id: roleId, businessId, isArchived: false });
  if (!role) {
    throw new ApiError("Invalid role", 400);
  }

  user.roleId = roleId;
  await user.save();

  await user.populate("roleId", "name level");

  new ApiResponse(
    {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.roleId,
        roleType: user.roleType,
      },
    },
    "User role updated successfully"
  ).send(res);
});

/**
 * @desc    Get user statistics
 * @route   GET /api/v1/users/stats
 * @access  Private (users:read:team)
 */
export const getUserStats = asyncHandler(async (req, res) => {
  const businessId = getBusinessId(req.user);

  const stats = await User.aggregate([
    {
      $match: {
        businessId: new mongoose.Types.ObjectId(businessId),
      },
    },
    {
      $group: {
        _id: "$isArchived",
        total: { $sum: 1 },
        active: {
          $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] },
        },
        byRole: {
          $push: {
            roleId: "$roleId",
            isActive: "$isActive",
          },
        },
      },
    },
  ]);

  // Process statistics
  const archivedStats = stats.find((stat) => stat._id === true) || {
    total: 0,
    active: 0,
    byRole: [],
  };
  const activeStats = stats.find((stat) => stat._id === false) || {
    total: 0,
    active: 0,
    byRole: [],
  };

  // Get role details for active users
  const roleStats = await Role.aggregate([
    {
      $match: {
        businessId: new mongoose.Types.ObjectId(businessId),
        isArchived: false,
      },
    },
    {
      $lookup: {
        from: "users",
        let: { roleId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$roleId", "$$roleId"] },
                  { $eq: ["$businessId", new mongoose.Types.ObjectId(businessId)] },
                  { $eq: ["$isArchived", false] },
                ],
              },
            },
          },
          {
            $group: {
              _id: "$isActive",
              count: { $sum: 1 },
            },
          },
        ],
        as: "userCounts",
      },
    },
    {
      $project: {
        name: 1,
        level: 1,
        totalUsers: {
          $sum: "$userCounts.count",
        },
        activeUsers: {
          $let: {
            vars: {
              activeGroup: {
                $arrayElemAt: [
                  {
                    $filter: {
                      input: "$userCounts",
                      as: "uc",
                      cond: { $eq: ["$$uc._id", true] },
                    },
                  },
                  0,
                ],
              },
            },
            in: { $ifNull: ["$$activeGroup.count", 0] },
          },
        },
      },
    },
  ]);

  new ApiResponse({
    summary: {
      totalUsers: activeStats.total + archivedStats.total,
      activeUsers: activeStats.total,
      archivedUsers: archivedStats.total,
      activeCount: activeStats.active,
      inactiveCount: activeStats.total - activeStats.active,
    },
    byRole: roleStats,
    recentActivity: {
      // Recent user activities
      last7Days: await User.countDocuments({
        businessId,
        isArchived: false,
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      }),
      last30Days: await User.countDocuments({
        businessId,
        isArchived: false,
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      }),
    },
  }).send(res);
});

/**
 * @desc    Check if user can be archived
 * @route   GET /api/v1/users/:id/can-archive
 * @access  Private (users:delete:team)
 */
export const checkArchiveEligibility = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const businessId = getBusinessId(req.user);

  const user = await User.findOne({ _id: id, businessId, isArchived: false });
  if (!user) {
    throw new ApiError("User not found or already archived", 404);
  }

  const reasons = [];

  // Check if user is self
  if (id === req.user._id.toString()) {
    reasons.push("Cannot archive your own account");
  }

  // Check if user is business owner
  const business = await Business.findOne({ _id: businessId, owner: id });
  if (business) {
    reasons.push("Cannot archive business owner");
  }

  const canArchive = reasons.length === 0;

  new ApiResponse({
    canArchive,
    reasons,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.roleType,
    },
  }).send(res);
});

/**
 * @desc    Get user activity history
 * @route   GET /api/v1/users/:id/activity
 * @access  Private
 */
export const getUserActivity = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { page = 1, limit = 10 } = req.query;

  // Ensure user belongs to this business logic if needed, 
  // currently just fetching by userId as per original logic.
  
  const logs = await ActivityLog.find({ userId: id })
    .sort({ timestamp: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  const total = await ActivityLog.countDocuments({ userId: id });

  new ApiResponse({ logs, pagination: { total, page, limit } }).send(res);
});