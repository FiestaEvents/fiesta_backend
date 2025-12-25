import express from "express";
import {
  getPartners,
  getPartner,
  createPartner,
  updatePartner,
  deletePartner,
  getPartnerStats,
  restorePartner,
  getArchivedPartners,
} from "../controllers/partnerController.js";

import { authenticate } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";
import validateRequest from "../middleware/validateRequest.js";

import {
  createPartnerValidator,
  updatePartnerValidator,
  partnerIdValidator,
} from "../validators/partnerValidator.js";

const router = express.Router();

// Apply authentication to all routes (Populates req.user.businessId)
router.use(authenticate);

// ==========================================
// STATIC ROUTES (Must come before /:id)
// ==========================================

// Stats
router.get(
  "/stats", 
  checkPermission("partners.read.all"), 
  getPartnerStats
);

// Archived List
router.get(
  "/archived", 
  checkPermission("partners.read.all"), 
  getArchivedPartners
);

// ==========================================
// RESTORE (Specific Action)
// ==========================================
router.patch(
  "/:id/restore",
  checkPermission("partners.delete.all"), // Restore often requires delete/admin privileges
  partnerIdValidator,
  validateRequest,
  restorePartner
);

// ==========================================
// MAIN CRUD ROUTES
// ==========================================

router
  .route("/")
  .get(
    checkPermission("partners.read.all"), 
    getPartners
  )
  .post(
    checkPermission("partners.create"),
    createPartnerValidator,
    validateRequest,
    createPartner
  );

router
  .route("/:id")
  .get(
    checkPermission("partners.read.all"),
    partnerIdValidator,
    validateRequest,
    getPartner
  )
  .put(
    checkPermission("partners.update.all"),
    updatePartnerValidator,
    validateRequest,
    updatePartner
  )
  .delete(
    checkPermission("partners.delete.all"),
    partnerIdValidator,
    validateRequest,
    deletePartner
  );

export default router;