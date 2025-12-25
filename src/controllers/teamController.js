import crypto from "crypto";
import asyncHandler from "../middleware/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { User, Role, TeamInvitation, Permission } from "../models/index.js";
// import { sendInvitationEmail } from "../services/emailService.js"; // Uncomment when email service is ready

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
 * Helper to safely get Business ID string
 */
const getBusinessId = (user) => {
  if (!user || !user.businessId) return null;
  return user.businessId._id ? user.businessId._id : user.businessId;
};

/**
 * @desc    Get all team members
 * @route   GET /api/v1/team
 * @access  Private
 */
export const getTeamMembers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status, roleId, search } = req.query;
  const businessId = getBusinessId(req.user);

  const query = { businessId };

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
  const businessId = getBusinessId(req.user);

  const user = await User.findOne({
    _id: req.params.id,
    businessId,
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
  const businessId = getBusinessId(req.user);

  // 1. Check if user already exists in this business
  const existingUser = await User.findOne({ email, businessId });
  if (existingUser) throw new ApiError("User already exists in this business", 400);

  // 2. Validate Role
  const role = await Role.findOne({ _id: roleId, businessId });
  if (!role) throw new ApiError("Invalid role", 404);

  // 3. Check for pending invitation
  const existingInvitation = await TeamInvitation.findOne({ email, businessId, status: "pending" });
  if (existingInvitation) throw new ApiError("Pending invitation already exists", 400);

  // Set explicit expiry (e.g., 48 hours)
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

  const invitation = new TeamInvitation({
    email,
    businessId, // Linked to generic Business
    roleId,
    invitedBy: req.user._id,
    message,
    expiresAt
  });

  const rawToken = invitation.generateInvitationToken 
    ? invitation.generateInvitationToken() 
    : invitation.token; // Fallback if method not on instance

  await invitation.save();

  const invitationLink = `${getFrontendUrl()}/accept-invite?token=${rawToken}`;

  try {
    // await sendInvitationEmail(email, invitationLink, req.user.name, message);
    console.log(`📧 Invitation Link: ${invitationLink}`);
  } catch (error) {
    console.warn("⚠️ Email service failed:", error.message);
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
  const businessId = getBusinessId(req.user);

  const invitations = await TeamInvitation.find({
    businessId,
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
 * @access  Public (No Auth Middleware)
 */
export const acceptInvitation = asyncHandler(async (req, res) => {
  const { token, name, password } = req.body;

  if (!token) throw new ApiError("Token is missing", 400);

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  // 1. Find Invitation with Deep Population for Permissions
  // Note: We populate 'businessId' to get the business name
  const invitation = await TeamInvitation.findOne({
    token: hashedToken,
    status: "pending",
  })
    .populate({
      path: "roleId",
      populate: { path: "permissions", model: "Permission" } 
    })
    .populate("businessId"); // generic Business model

  if (!invitation) throw new ApiError("Invalid or expired invitation", 400);

  if (invitation.expiresAt < new Date()) {
    invitation.status = "expired";
    await invitation.save();
    throw new ApiError("Invitation has expired", 400);
  }

  // 2. Validate User Existence via Invitation Email (Security)
  // Ensure we don't duplicate global users if email is unique globally
  const existingUser = await User.findOne({ email: invitation.email });
  if (existingUser) throw new ApiError("User account with this email already exists", 400);

  // 3. Create User (Enforcing invitation.email)
  const user = await User.create({
    name,
    email: invitation.email, // 🔒 SECURITY: Ignore req.body.email
    password,
    roleId: invitation.roleId._id,
    roleType: invitation.roleId.isSystemRole 
      ? invitation.roleId.name.toLowerCase() 
      : "custom",
    businessId: invitation.businessId._id, // Assign to Business
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
  // Dynamic import to avoid circular dependency if tokenService imports User
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
        business: {
          id: invitation.businessId._id,
          name: invitation.businessId.name,
          category: invitation.businessId.category, // e.g. 'venue', 'catering'
        },
        permissions: permissionsList, // ✅ Strings only
      },
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
    .populate("businessId", "name category") // Populate generic Business
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
    businessName: invitation.businessId?.name || "Unknown Business",
    businessCategory: invitation.businessId?.category || "generic",
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
  const businessId = getBusinessId(req.user);

  const invitation = await TeamInvitation.findOne({
    _id: req.params.id,
    businessId,
    status: "pending",
  }).populate("roleId");

  if (!invitation) throw new ApiError("Invitation not found", 404);

  // Generate new token
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
  const businessId = getBusinessId(req.user);

  const invitation = await TeamInvitation.findOne({
    _id: req.params.id,
    businessId,
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
  const businessId = getBusinessId(req.user);

  const user = await User.findOne({ _id: req.params.id, businessId });
  if (!user) throw new ApiError("Team member not found", 404);

  if (user.roleType === "owner") throw new ApiError("Cannot modify owner", 403);

  if (roleId) {
    const role = await Role.findOne({ _id: roleId, businessId });
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
  const businessId = getBusinessId(req.user);

  const user = await User.findOne({ _id: req.params.id, businessId });
  if (!user) throw new ApiError("Team member not found", 404);
  
  if (user.roleType === "owner") throw new ApiError("Cannot remove business owner", 400);
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
  const businessId = getBusinessId(req.user);
  
  const [totalMembers, activeMembers, pendingInvitations] = await Promise.all([
    User.countDocuments({ businessId }),
    User.countDocuments({ businessId, isActive: true }),
    TeamInvitation.countDocuments({ businessId, status: "pending" }),
  ]);

  new ApiResponse({ totalMembers, activeMembers, pendingInvitations }).send(res);
});