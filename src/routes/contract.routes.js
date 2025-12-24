// src/routes/contractRoutes.js
const express = require('express');
const {
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
} = require('../controllers/contractController');

const { authenticate } = require('../middleware/authMiddleware');
const { checkPermission } = require('../middleware/permissionMiddleware');
const validateRequest = require('../middleware/validateRequest');

const {
  createContractValidator,
  updateContractValidator,
  contractIdValidator,
  contractSettingsValidator,
} = require('../validators/contractValidator');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// ============================================
// SETTINGS (Must come before /:id)
// ============================================
router
  .route("/settings")
  .get(
    // Updated from 'venue.read' to 'business.read' to match new architecture
    checkPermission("business.read"), 
    getContractSettings
  )
  .put(
    checkPermission("business.update"),
    contractSettingsValidator,
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

module.exports = router;