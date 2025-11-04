import crypto from "crypto";
import asyncHandler from "../middleware/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { User, Role, TeamInvitation } from "../models/index.js";
import { sendInvitationEmail } from "../utils/emailService.js";

/**
 * @desc    Get all team members
 * @route   GET /api/v1/team
 * @access  Private (users.read.all)
 */
export const getTeamMembers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status, roleId, search } = req.query;

  // Build query
  const query = { venueId: req.user.venueId };

  if (status) query.isActive = status === "active";
  if (roleId) query.roleId = roleId;

  // Search by name or email
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  // Pagination
  const skip = (page - 1) * limit;

  // Execute query
  const [users, total] = await Promise.all([
    User.find(query)
      .populate("roleId")
      .populate("invitedBy", "name email")
      .select("-password")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    User.countDocuments(query),
  ]);

  new ApiResponse({
    users,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit),
    },
  }).send(res);
});

/**
 * @desc    Get single team member
 * @route   GET /api/v1/team/:id
 * @access  Private (users.read.all)
 */
export const getTeamMember = asyncHandler(async (req, res) => {
  const user = await User.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  })
    .populate("roleId")
    .populate("invitedBy", "name email")
    .select("-password");

  if (!user) {
    throw new ApiError("Team member not found", 404);
  }

  new ApiResponse({ user }).send(res);
});

/**
 * @desc    Invite team member
 * @route   POST /api/v1/team/invite
 * @access  Private (users.create)
 */
export const inviteTeamMember = asyncHandler(async (req, res) => {
  const { email, roleId, message } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({
    email,
    venueId: req.user.venueId,
  });

  if (existingUser) {
    throw new ApiError("User already exists in this venue", 400);
  }

  // Verify role exists and belongs to venue
  const role = await Role.findOne({
    _id: roleId,
    venueId: req.user.venueId,
  });

  if (!role) {
    throw new ApiError("Invalid role", 404);
  }

  // Check for existing pending invitation
  const existingInvitation = await TeamInvitation.findOne({
    email,
    venueId: req.user.venueId,
    status: "pending",
  });

  if (existingInvitation) {
    throw new ApiError("Pending invitation already exists for this email", 400);
  }

  // Create invitation
  const invitation = await TeamInvitation.create({
    email,
    venueId: req.user.venueId,
    roleId,
    invitedBy: req.user._id,
    message,
  });

  // Send invitation email
  try {
    await sendInvitationEmail({
      email,
      token: invitation.token,
      inviterName: req.user.name,
      venueName: req.venue.name,
      roleName: role.name,
      message,
    });

    new ApiResponse(
      { invitation },
      "Invitation sent successfully",
      201
    ).send(res);
  } catch (error) {
    // Delete invitation if email fails
    await invitation.deleteOne();
    throw new ApiError("Failed to send invitation email", 500);
  }
});

/**
 * @desc    Get pending invitations
 * @route   GET /api/v1/team/invitations
 * @access  Private (users.read.all)
 */
export const getPendingInvitations = asyncHandler(async (req, res) => {
  const invitations = await TeamInvitation.find({
    venueId: req.user.venueId,
    status: "pending",
  })
    .populate("roleId", "name description")
    .populate("invitedBy", "name email")
    .sort({ createdAt: -1 });

  new ApiResponse({ invitations }).send(res);
});

/**
 * @desc    Accept invitation
 * @route   POST /api/v1/team/accept-invitation
 * @access  Public
 */
export const acceptInvitation = asyncHandler(async (req, res) => {
  const { token, name, password } = req.body;

  // Find invitation
  const invitation = await TeamInvitation.findOne({
    token,
    status: "pending",
  })
    .populate("roleId")
    .populate("venueId");

  if (!invitation) {
    throw new ApiError("Invalid or expired invitation", 400);
  }

  // Check if invitation has expired
  if (invitation.expiresAt < new Date()) {
    invitation.status = "expired";
    await invitation.save();
    throw new ApiError("Invitation has expired", 400);
  }

  // Check if user already exists
  const existingUser = await User.findOne({ email: invitation.email });

  if (existingUser) {
    throw new ApiError("User already exists", 400);
  }

  // Create user
  const user = await User.create({
    name,
    email: invitation.email,
    password,
    roleId: invitation.roleId._id,
    roleType: invitation.roleId.isSystemRole
      ? invitation.roleId.name.toLowerCase()
      : "custom",
    venueId: invitation.venueId._id,
    invitedBy: invitation.invitedBy,
    invitedAt: invitation.createdAt,
    acceptedAt: new Date(),
    isActive: true,
  });

  // Update invitation status
  invitation.status = "accepted";
  invitation.acceptedAt = new Date();
  await invitation.save();

  // Generate token
  const { generateToken } = await import("../utils/tokenService.js");
  const authToken = generateToken(user._id);

  new ApiResponse(
    {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: invitation.roleId.name,
        venue: invitation.venueId.name,
      },
      token: authToken,
    },
    "Invitation accepted successfully",
    201
  ).send(res);
});

/**
 * @desc    Resend invitation
 * @route   POST /api/v1/team/invitations/:id/resend
 * @access  Private (users.create)
 */
export const resendInvitation = asyncHandler(async (req, res) => {
  const invitation = await TeamInvitation.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
    status: "pending",
  }).populate("roleId");

  if (!invitation) {
    throw new ApiError("Invitation not found", 404);
  }

  // Generate new token and extend expiry
  invitation.token = crypto.randomBytes(32).toString("hex");
  invitation.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await invitation.save();

  // Resend email
  await sendInvitationEmail({
    email: invitation.email,
    token: invitation.token,
    inviterName: req.user.name,
    venueName: req.venue.name,
    roleName: invitation.roleId.name,
    message: invitation.message,
  });

  new ApiResponse({ invitation }, "Invitation resent successfully").send(res);
});

/**
 * @desc    Cancel invitation
 * @route   DELETE /api/v1/team/invitations/:id
 * @access  Private (users.delete.all)
 */
export const cancelInvitation = asyncHandler(async (req, res) => {
  const invitation = await TeamInvitation.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
    status: "pending",
  });

  if (!invitation) {
    throw new ApiError("Invitation not found", 404);
  }

  invitation.status = "cancelled";
  await invitation.save();

  new ApiResponse(null, "Invitation cancelled successfully").send(res);
});

/**
 * @desc    Update team member
 * @route   PUT /api/v1/team/:id
 * @access  Private (users.update.all)
 */
export const updateTeamMember = asyncHandler(async (req, res) => {
  const { roleId, isActive, customPermissions } = req.body;

  const user = await User.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  });

  if (!user) {
    throw new ApiError("Team member not found", 404);
  }

  // Prevent owner from modifying their own role
  if (
    user.roleType === "owner" &&
    user._id.toString() === req.user._id.toString()
  ) {
    throw new ApiError("Cannot modify your own owner role", 400);
  }

  // Prevent modifying other owners unless you're an owner
  if (user.roleType === "owner" && req.user.roleType !== "owner") {
    throw new ApiError("Only owners can modify other owners", 403);
  }

  // Validate new role if provided
  if (roleId) {
    const role = await Role.findOne({
      _id: roleId,
      venueId: req.user.venueId,
    });

    if (!role) {
      throw new ApiError("Invalid role", 404);
    }

    user.roleId = roleId;
    user.roleType = role.isSystemRole ? role.name.toLowerCase() : "custom";
  }

  if (isActive !== undefined) {
    user.isActive = isActive;
  }

  if (customPermissions) {
    user.customPermissions = customPermissions;
  }

  await user.save();

  const updatedUser = await User.findById(user._id)
    .populate("roleId")
    .select("-password");

  new ApiResponse({ user: updatedUser }, "Team member updated successfully").send(res);
});

/**
 * @desc    Remove team member
 * @route   DELETE /api/v1/team/:id
 * @access  Private (users.delete.all)
 */
export const removeTeamMember = asyncHandler(async (req, res) => {
  const user = await User.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  }).populate("roleId");

  if (!user) {
    throw new ApiError("Team member not found", 404);
  }

  // Prevent removing venue owner
  if (user.roleType === "owner") {
    throw new ApiError("Cannot remove venue owner", 400);
  }

  // Prevent removing yourself
  if (user._id.toString() === req.user._id.toString()) {
    throw new ApiError("Cannot remove yourself", 400);
  }

  // Soft delete
  user.isActive = false;
  await user.save();

  new ApiResponse(null, "Team member removed successfully").send(res);
});

/**
 * @desc    Get team statistics
 * @route   GET /api/v1/team/stats
 * @access  Private (users.read.all)
 */
export const getTeamStats = asyncHandler(async (req, res) => {
  const venueId = req.user.venueId;

  const [totalMembers, activeMembers, roleDistribution, pendingInvitations] =
    await Promise.all([
      User.countDocuments({ venueId }),
      User.countDocuments({ venueId, isActive: true }),
      User.aggregate([
        { $match: { venueId } },
        {
          $group: {
            _id: "$roleType",
            count: { $sum: 1 },
          },
        },
      ]),
      TeamInvitation.countDocuments({ venueId, status: "pending" }),
    ]);

  new ApiResponse({
    totalMembers,
    activeMembers,
    inactiveMembers: totalMembers - activeMembers,
    roleDistribution,
    pendingInvitations,
  }).send(res);
});