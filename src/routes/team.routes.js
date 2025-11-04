import express from "express";
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
} from "../controllers/teamController.js";
import { authenticate } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";
import { param, body } from "express-validator";
import validateRequest from "../middleware/validateRequest.js";

const router = express.Router();

// Public route for accepting invitations
router.post(
  "/accept-invitation",
  body("token").notEmpty().withMessage("Token is required"),
  body("name").notEmpty().withMessage("Name is required"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),
  validateRequest,
  acceptInvitation
);

// Protected routes
router.use(authenticate);

// Stats
router.get("/stats", checkPermission("users.read.all"), getTeamStats);

// Invitations
router.get(
  "/invitations",
  checkPermission("users.read.all"),
  getPendingInvitations
);

router.post(
  "/invite",
  checkPermission("users.create"),
  body("email").isEmail().withMessage("Valid email is required"),
  body("roleId").isMongoId().withMessage("Valid role ID is required"),
  validateRequest,
  inviteTeamMember
);

router.post(
  "/invitations/:id/resend",
  checkPermission("users.create"),
  param("id").isMongoId(),
  validateRequest,
  resendInvitation
);

router.delete(
  "/invitations/:id",
  checkPermission("users.delete.all"),
  param("id").isMongoId(),
  validateRequest,
  cancelInvitation
);

// Team members
router
  .route("/")
  .get(checkPermission("users.read.all"), getTeamMembers);

router
  .route("/:id")
  .get(
    checkPermission("users.read.all"),
    param("id").isMongoId(),
    validateRequest,
    getTeamMember
  )
  .put(
    checkPermission("users.update.all"),
    param("id").isMongoId(),
    validateRequest,
    updateTeamMember
  )
  .delete(
    checkPermission("users.delete.all"),
    param("id").isMongoId(),
    validateRequest,
    removeTeamMember
  );

export default router;