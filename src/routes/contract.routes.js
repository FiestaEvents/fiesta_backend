import express from "express";
import {
  // CRUD
  getContracts,
  getContractById,
  createContract,
  updateContract,
  deleteContract,
  // Archive
  archiveContract,
  restoreContract,
  // Actions
  sendContract,
  duplicateContract,
  markContractViewed,
  signContract,
  // Settings
  getContractSettings,
  updateContractSettings,
  // Stats & Download
  getContractStats,
  downloadContractPdf,
} from "../controllers/contractController.js";
import { authenticate } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";
import validateRequest from "../middleware/validateRequest.js";
import {
  createContractValidator,
  updateContractValidator,
  contractIdValidator,
  contractSettingsValidator,
} from "../validators/contractValidator.js";

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// ============================================
// SETTINGS (Must come before /:id)
// ============================================
router
  .route("/settings")
  .get(
    checkPermission("venue.read"), // Settings usually fall under venue permissions
    getContractSettings
  )
  .put(
    checkPermission("venue.update"),
    contractSettingsValidator, // Validate settings payload
    validateRequest,
    updateContractSettings
  );

// ============================================
// STATS
// ============================================
router.get(
  "/stats",
  checkPermission("contracts.read.all"),
  getContractStats
);

// ============================================
// MAIN CRUD
// ============================================
router
  .route("/")
  .get(
    checkPermission("contracts.read.all"),
    getContracts
  )
  .post(
    checkPermission("contracts.create"),
    createContractValidator,
    validateRequest,
    createContract
  );

// ============================================
// ACTIONS (Specific Operations)
// ============================================

// Download
router.get(
  "/:id/download",
  checkPermission("contracts.read.all"),
  contractIdValidator,
  validateRequest,
  downloadContractPdf
);

// Archive/Restore
router.patch(
  "/:id/archive",
  checkPermission("contracts.delete.all"),
  contractIdValidator,
  validateRequest,
  archiveContract
);

router.patch(
  "/:id/restore",
  checkPermission("contracts.update.all"),
  contractIdValidator,
  validateRequest,
  restoreContract
);

// Business Logic Actions
router.post(
  "/:id/send",
  checkPermission("contracts.update.all"),
  contractIdValidator,
  validateRequest,
  sendContract
);

router.post(
  "/:id/duplicate",
  checkPermission("contracts.create"),
  contractIdValidator,
  validateRequest,
  duplicateContract
);

router.patch(
  "/:id/view",
  checkPermission("contracts.read.all"),
  contractIdValidator,
  validateRequest,
  markContractViewed
);

router.post(
  "/:id/sign",
  checkPermission("contracts.update.all"),
  contractIdValidator,
  validateRequest,
  signContract
);

// ============================================
// DYNAMIC ROUTES (/:id)
// ============================================
router
  .route("/:id")
  .get(
    checkPermission("contracts.read.all"),
    contractIdValidator,
    validateRequest,
    getContractById
  )
  .put(
    checkPermission("contracts.update.all"),
    updateContractValidator,
    validateRequest,
    updateContract
  )
  .delete(
    checkPermission("contracts.delete.all"),
    contractIdValidator,
    validateRequest,
    deleteContract
  );

export default router;