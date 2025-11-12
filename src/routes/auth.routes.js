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
} from "../validators/authValidator.js";

const router = express.Router();

// Public routes
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

// Protected routes
router.get("/me", authenticate, getCurrentUser);
router.put("/profile", authenticate, updateProfile);
router.put("/change-password", authenticate, changePassword);
router.post("/logout", authenticate, logout);

// Archive routes
router.patch("/archive", authenticate, archiveAccount);
router.get("/stats", authenticate, getUserStats);

export default router;
