import crypto from "crypto";
import asyncHandler from "../middleware/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { User, Role, TeamInvitation, Permission } from "../models/index.js";
import { sendInvitationEmail } from "../services/emailService.js";

// ✅ CONFIG: Get Frontend URL
const getFrontendUrl = () => 
  process.env.CLIENT_URL || process.env.FRONTEND_URL || 'https://fiesta.events';

// ✅ HELPER: Cookie Options (Must match AuthController)
const getCookieOptions = () => {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    httpOnly: true, // Prevents XSS
    secure: isProduction, // HTTPS only in prod
    sameSite: isProduction ? "strict" : "lax",
    path: '/'
  };
};

/**
 * @desc    Get all team members
 * @route   GET /api/v1/team
 * @access  Private
 */
export const getTeamMembers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status, roleId, search } = req.query;
  const query = { venueId: req.user.venueId };

  if (status) query.isActive = status === "active";
  if (roleId) query.roleId = roleId;

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  const skip = (page - 1) * limit;

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
 * @access  Private
 */
export const getTeamMember = asyncHandler(async (req, res) => {
  const user = await User.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  })
    .populate("roleId")
    .populate("invitedBy", "name email")
    .select("-password");

  if (!user) throw new ApiError("Team member not found", 404);

  new ApiResponse({ user }).send(res);
});

/**
 * @desc    Invite team member
 * @route   POST /api/v1/team/invite
 * @access  Private
 */
export const inviteTeamMember = asyncHandler(async (req, res) => {
  const { email, roleId, message } = req.body;
  const { venueId } = req.user;

  const existingUser = await User.findOne({ email, venueId });
  if (existingUser) throw new ApiError("User already exists in this venue", 400);

  const role = await Role.findOne({ _id: roleId, venueId });
  if (!role) throw new ApiError("Invalid role", 404);

  const existingInvitation = await TeamInvitation.findOne({ email, venueId, status: "pending" });
  if (existingInvitation) throw new ApiError("Pending invitation already exists", 400);

  // Set explicit expiry (e.g., 48 hours)
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

  const invitation = new TeamInvitation({
    email,
    venueId,
    roleId,
    invitedBy: req.user._id,
    message,
    expiresAt
  });

  const rawToken = invitation.generateInvitationToken 
    ? invitation.generateInvitationToken() 
    : invitation.token; 

  await invitation.save();

  const invitationLink = `${getFrontendUrl()}/accept-invite?token=${rawToken}`;

  try {
    console.log(`📧 Invitation Link: ${invitationLink}`);
  } catch (error) {
    console.warn("⚠️ Email service failed.");
  }

  new ApiResponse(
    { invitation, invitationLink },
    "Invitation generated successfully",
    201
  ).send(res);
});

/**
 * @desc    Get pending invitations
 * @route   GET /api/v1/team/invitations
 * @access  Private
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
 * @route   POST /api/v1/team/invitations/accept
 * @access  Public
 */
export const acceptInvitation = asyncHandler(async (req, res) => {
  const { token, name, password } = req.body;

  if (!token) throw new ApiError("Token is missing", 400);

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  // 1. Find Invitation with Deep Population for Permissions
  const invitation = await TeamInvitation.findOne({
    token: hashedToken,
    status: "pending",
  })
    .populate({
      path: "roleId",
      populate: { path: "permissions", model: "Permission" } 
    })
    .populate("venueId");

  if (!invitation) throw new ApiError("Invalid or expired invitation", 400);

  if (invitation.expiresAt < new Date()) {
    invitation.status = "expired";
    await invitation.save();
    throw new ApiError("Invitation has expired", 400);
  }

  // 2. Validate User Existence via Invitation Email (Security)
  const existingUser = await User.findOne({ email: invitation.email });
  if (existingUser) throw new ApiError("User already exists", 400);

  // 3. Create User (Enforcing invitation.email)
  const user = await User.create({
    name,
    email: invitation.email, // 🔒 SECURITY: Ignore req.body.email
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

  // 4. Update Invitation
  invitation.status = "accepted";
  invitation.acceptedAt = new Date();
  await invitation.save();

  // 5. Generate Token
  const { generateToken } = await import("../utils/tokenService.js");
  const authToken = generateToken(user._id);

  // 6. Set HttpOnly Cookie (CRITICAL for AuthContext)
  res.cookie("jwt", authToken, getCookieOptions());

  // 7. Flatten Permissions for Frontend
  let permissionsList = [];
  if (invitation.roleId && invitation.roleId.permissions) {
    // Map objects to strings
    permissionsList = invitation.roleId.permissions.map(p => p.name);
  }

  // 8. Send Response
  new ApiResponse(
    {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
        role: {
          id: invitation.roleId._id,
          name: invitation.roleId.name,
          type: user.roleType,
          level: invitation.roleId.level,
        },
        venue: {
          id: invitation.venueId._id,
          name: invitation.venueId.name,
        },
        permissions: permissionsList, // ✅ Strings only
      },
      // Note: We don't need to send token in body anymore, but keeping it doesn't hurt
      token: authToken, 
    },
    "Invitation accepted successfully",
    201
  ).send(res);
});

/**
 * @desc    Validate invitation token & get details
 * @route   GET /api/v1/team/invitations/validate
 * @access  Public
 */
export const validateInvitationToken = asyncHandler(async (req, res) => {
  const { token } = req.query;
  if (!token) throw new ApiError("Token is required", 400);

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  const invitation = await TeamInvitation.findOne({
    token: hashedToken,
    status: "pending",
  })
    .populate("venueId", "name")
    .populate("roleId", "name")
    .populate("invitedBy", "name");

  if (!invitation) throw new ApiError("Invalid invitation link", 404);

  if (invitation.expiresAt < new Date()) {
    invitation.status = "expired";
    await invitation.save();
    throw new ApiError("Invitation link has expired", 400);
  }

  new ApiResponse({
    valid: true,
    email: invitation.email,
    venueName: invitation.venueId?.name || "Unknown Venue",
    roleName: invitation.roleId?.name || "Member",
    inviterName: invitation.invitedBy?.name || "Administrator"
  }).send(res);
});

/**
 * @desc    Resend invitation
 * @route   POST /api/v1/team/invitations/:id/resend
 * @access  Private
 */
export const resendInvitation = asyncHandler(async (req, res) => {
  const invitation = await TeamInvitation.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
    status: "pending",
  }).populate("roleId");

  if (!invitation) throw new ApiError("Invitation not found", 404);

  const rawToken = crypto.randomBytes(32).toString("hex");
  
  invitation.token = crypto.createHash("sha256").update(rawToken).digest("hex");
  invitation.expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // Reset to 48 hours
  await invitation.save();

  const invitationLink = `${getFrontendUrl()}/accept-invite?token=${rawToken}`;
  console.log(`📧 Resent Link: ${invitationLink}`);

  new ApiResponse({ invitation, invitationLink }, "Invitation resent successfully").send(res);
});

/**
 * @desc    Cancel invitation
 * @route   DELETE /api/v1/team/invitations/:id
 * @access  Private
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

  invitation.status = "revoked"; 
  await invitation.save();

  new ApiResponse(null, "Invitation revoked successfully").send(res);
});

/**
 * @desc    Update team member
 * @route   PUT /api/v1/team/:id
 * @access  Private
 */
export const updateTeamMember = asyncHandler(async (req, res) => {
  const { roleId, isActive, customPermissions } = req.body;

  const user = await User.findOne({ _id: req.params.id, venueId: req.user.venueId });
  if (!user) throw new ApiError("Team member not found", 404);

  if (user.roleType === "owner") throw new ApiError("Cannot modify owner", 403);

  if (roleId) {
    const role = await Role.findOne({ _id: roleId, venueId: req.user.venueId });
    if (!role) throw new ApiError("Invalid role", 404);
    user.roleId = roleId;
    user.roleType = role.isSystemRole ? role.name.toLowerCase() : "custom";
  }

  if (isActive !== undefined) user.isActive = isActive;
  if (customPermissions) user.customPermissions = customPermissions;

  await user.save();
  const updatedUser = await User.findById(user._id).populate("roleId").select("-password");

  new ApiResponse({ user: updatedUser }, "Team member updated successfully").send(res);
});

/**
 * @desc    Remove team member
 * @route   DELETE /api/v1/team/:id
 * @access  Private
 */
export const removeTeamMember = asyncHandler(async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, venueId: req.user.venueId });
  if (!user) throw new ApiError("Team member not found", 404);
  
  if (user.roleType === "owner") throw new ApiError("Cannot remove venue owner", 400);
  if (user._id.toString() === req.user._id.toString()) throw new ApiError("Cannot remove yourself", 400);

  user.isActive = false; // Soft delete
  await user.save();

  new ApiResponse(null, "Team member removed successfully").send(res);
});

/**
 * @desc    Get team statistics
 * @route   GET /api/v1/team/stats
 * @access  Private
 */
export const getTeamStats = asyncHandler(async (req, res) => {
  const venueId = req.user.venueId;
  const [totalMembers, activeMembers, pendingInvitations] = await Promise.all([
    User.countDocuments({ venueId }),
    User.countDocuments({ venueId, isActive: true }),
    TeamInvitation.countDocuments({ venueId, status: "pending" }),
  ]);

  new ApiResponse({ totalMembers, activeMembers, pendingInvitations }).send(res);
});