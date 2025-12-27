import express from "express";
import { authenticate } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";
import {
  getMyBusiness,
  updateBusiness,
  getResources,
  createResource,
  updateResource,
  deleteResource
} from "../controllers/businessController.js";

const router = express.Router();

router.use(authenticate);

// --- Profile ---
router.route("/me")
  .get(checkPermission("business.read"), getMyBusiness)
  .put(checkPermission("business.update"), updateBusiness);

// --- Resources (Spaces) ---
router.route("/resources")
  .get(getResources) // Basic read access
  .post(checkPermission("business.update"), createResource);

router.route("/resources/:id")
  .put(checkPermission("business.update"), updateResource)
  .delete(checkPermission("business.delete"), deleteResource);

export default router;