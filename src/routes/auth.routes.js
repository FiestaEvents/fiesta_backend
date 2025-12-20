import express from "express";
import {
  register,
  login,
  getCurrentUser,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  logout,
  verifyEmail,
  archiveAccount,
  restoreAccount,
  getUserStats,

} from "../controllers/authController.js";
import { authenticate } from "../middleware/auth.js";
import validateRequest from "../middleware/validateRequest.js";
import {
  registerValidator,
  loginValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  emailValidator,
  restoreAccountValidator,
  updateProfileValidator,
  changePasswordValidator,
  archiveAccountValidator,
} from "../validators/authValidator.js";

const router = express.Router();

// ==========================================
// PUBLIC ROUTES (No Token Required)
// ==========================================

router.post("/register", registerValidator, validateRequest, register);

router.post("/login", loginValidator, validateRequest, login);

router.post("/verify-email", emailValidator, validateRequest, verifyEmail);

router.post(
  "/forgot-password",
  forgotPasswordValidator,
  validateRequest,
  forgotPassword
);

router.post(
  "/reset-password",
  resetPasswordValidator,
  validateRequest,
  resetPassword
);

router.post(
  "/restore-account",
  restoreAccountValidator,
  validateRequest,
  restoreAccount
);

// ==========================================
// PROTECTED ROUTES (Token Required)
// ==========================================
router.use(authenticate);

// Session Management
router.get("/me", getCurrentUser);
router.post("/logout", logout);

// Profile Management
router.put("/profile", updateProfileValidator, validateRequest, updateProfile);

router.put(
  "/change-password",
  changePasswordValidator,
  validateRequest,
  changePassword
);

// Account Settings & Stats
router.patch(
  "/archive",
  archiveAccountValidator,
  validateRequest,
  archiveAccount
);

router.get(
  "/stats", getUserStats);


export default router;
