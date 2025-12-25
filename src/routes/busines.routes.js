import express from "express";
import {
  getBusiness,
  updateBusiness,
  updateSubscription,
  getBusinessStats,
  getDashboardData,
  getSpaces,
  createSpace,
  getSpace,
  updateSpace,
  deleteSpace,
} from "../controllers/businessController.js";
import { authenticate } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";

const router = express.Router();

router.use(authenticate);

// ==========================================
// DASHBOARD & ANALYTICS
// ==========================================

router.get("/dashboard", getDashboardData);

router.get("/stats", getBusinessStats);

// ==========================================
// SUBSCRIPTION
// ==========================================

router.put(
  "/subscription",
  checkPermission("business.manage"), // Renamed from venue.manage
  updateSubscription
);

// ==========================================
// BUSINESS PROFILE (The Chameleon)
// ==========================================

router
  .route("/me")
  .get(
    checkPermission("business.read"), // Renamed from venue.read
    getBusiness
  )
  .put(
    checkPermission("business.update"), // Renamed from venue.update
    updateBusiness
  );

// ==========================================
// SPACE MANAGEMENT (Resources)
// ==========================================
// These endpoints manage "Spaces" (Venues) or generic "Resources" (Other verticals)

router
  .route("/spaces")
  .get(
    checkPermission("spaces.read"), // Generic permission 'resources' instead of 'venue'
    getSpaces
  )
  .post(
    checkPermission("spaces.create"), 
    createSpace
  );

router
  .route("/spaces/:spaceId")
  .get(
    checkPermission("spaces.read"), 
    getSpace
  )
  .put(
    checkPermission("spaces.update"), 
    updateSpace
  )
  .delete(
    checkPermission("spaces.delete"), 
    deleteSpace
  );

export default router;