import express from "express";
import { authenticate, authorizeSuperAdmin } from "../middleware/auth.js";
import {
  getAllBusinesses,
  getAllUsers,
  manageSubscription,
  manageUser
} from "../controllers/adminController.js";

const router = express.Router();

// 🔒 Global Lock: All routes require Auth + SuperAdmin
router.use(authenticate, authorizeSuperAdmin);

// Business & Subscription Management
router.get("/businesses", getAllBusinesses);
router.patch("/business/:id/subscription", manageSubscription);

// Global User Management
router.get("/users", getAllUsers);
router.patch("/users/:id", manageUser);

export default router;