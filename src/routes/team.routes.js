import express from "express";
import rateLimit from "express-rate-limit";
import { param, body } from "express-validator";
import {
  getTeamMembers,
  getTeamMember,
  inviteTeamMember,
  getPendingInvitations,
  acceptInvitation,
  resendInvitation,
  cancelInvitation,
  updateTeamMember,
  removeTeamMember,
  getTeamStats,
  validateInvitationToken,
} from "../controllers/teamController.js";
import { authenticate } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";
import validateRequest from "../middleware/validateRequest.js";

const router = express.Router();

// ==========================================
// CONFIGURATION
// ==========================================

// Rate limiter for validation endpoint to prevent brute-force token guessing
const inviteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 requests per windowMs
  message: "Too many attempts, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});

// ==========================================
// 🔓 PUBLIC ROUTES (No Token Required)
// ==========================================

// 1. Validate Invitation Token (Moved UP here to avoid 401 error)
// Used when a user clicks the link in their email
router.get(
  "/invitations/validate", 
  inviteLimiter, 
  validateInvitationToken
);

// 2. Accept Invitation
// Creates the user account and links it to the Business
router.post(
  "/invitations/accept",
  [
    body("token").notEmpty().withMessage("Token is required"),
    body("name").notEmpty().withMessage("Name is required"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters"),
  ],
  validateRequest,
  acceptInvitation
);

// ==========================================
// 🔒 PROTECTED ROUTES (Login Required)
// ==========================================
// All routes below require req.user to be populated with businessId
router.use(authenticate);

// --- Statistics ---
router.get("/stats", checkPermission("users.read.all"), getTeamStats);

// --- Invitations Management ---
router.get(
  "/invitations",
  checkPermission("users.read.all"),
  getPendingInvitations
);

router.post(
  "/invite",
  checkPermission("users.create"),
  [
    body("email").isEmail().withMessage("Valid email is required"),
    body("roleId").isMongoId().withMessage("Valid role ID is required"),
  ],
  validateRequest,
  inviteTeamMember
);

router.post(
  "/invitations/:id/resend",
  checkPermission("users.create"),
  [param("id").isMongoId().withMessage("Invalid Invitation ID")],
  validateRequest,
  resendInvitation
);

router.delete(
  "/invitations/:id",
  checkPermission("users.delete.all"),
  [param("id").isMongoId().withMessage("Invalid Invitation ID")],
  validateRequest,
  cancelInvitation
);

// --- Team Member Management ---
router
  .route("/")
  .get(checkPermission("users.read.all"), getTeamMembers);

router
  .route("/:id")
  .all([
    param("id").isMongoId().withMessage("Invalid User ID"), 
    validateRequest
  ]) 
  .get(
    checkPermission("users.read.all"), 
    getTeamMember
  )
  .put(
    checkPermission("users.update.all"),
    updateTeamMember
  )
  .delete(
    checkPermission("users.delete.all"),
    removeTeamMember
  );

export default router;