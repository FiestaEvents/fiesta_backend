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
import { param } from "express-validator";

const router = express.Router();

router.use(authenticate);

// Stats
router.get("/stats", checkPermission("partners.read.all"), getPartnerStats);

// Archived partners
router.get("/archived", checkPermission("partners.read.all"), getArchivedPartners);

// CRUD operations
router
  .route("/")
  .get(checkPermission("partners.read.all"), getPartners)
  .post(checkPermission("partners.create"), createPartner);

router
  .route("/:id")
  .get(
    checkPermission("partners.read.all"),
    param("id").isMongoId(),
    validateRequest,
    getPartner
  )
  .put(
    checkPermission("partners.update.all"),
    param("id").isMongoId(),
    validateRequest,
    updatePartner
  )
  .delete(
    checkPermission("partners.delete.all"),
    param("id").isMongoId(),
    validateRequest,
    deletePartner
  );

// Restore archived partner
router.patch(
  "/:id/restore",
  checkPermission("partners.update.all"),
  param("id").isMongoId(),
  validateRequest,
  restorePartner
);

export default router;