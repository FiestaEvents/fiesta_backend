import express from "express";
import {
  getVenue,
  updateVenue,
  updateSubscription,
  getVenueStats,
  getDashboardData,
  getVenueSpaces,
  createVenueSpace,
  getVenueSpace,
  updateVenueSpace,
  deleteVenueSpace,
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

// Venue Spaces
router
  .route("/spaces")
  .get(checkPermission("venue.read"), getVenueSpaces)
  .post(checkPermission("venue.create"), createVenueSpace);

router
  .route("/spaces/:spaceId")
  .get(checkPermission("venue.read"), getVenueSpace)
  .put(checkPermission("venue.update"), updateVenueSpace)
  .delete(checkPermission("venue.delete"), deleteVenueSpace);
router.post(
  "/portfolio", 
  upload.single("image"), 
  uploadPortfolioImage
);

export default router;
