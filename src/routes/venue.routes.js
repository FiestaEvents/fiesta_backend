import express from "express";
import {
  getVenue,
  updateVenue,
  updateSubscription,
  getVenueStats,
  getDashboardData,
} from "../controllers/venueController.js";
import { authenticate } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";

const router = express.Router();

router.use(authenticate);

// Dashboard
router.get("/dashboard", getDashboardData);

// Stats
router.get("/stats", getVenueStats);

// Subscription
router.put(
  "/subscription",
  checkPermission("venue.manage"),
  updateSubscription
);

// Venue details
router
  .route("/me")
  .get(checkPermission("venue.read"), getVenue)
  .put(checkPermission("venue.update"), updateVenue);

export default router;
