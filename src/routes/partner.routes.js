// src/routes/partnerRoutes.js
const express = require('express');
const {
  getPartners,
  getPartner,
  createPartner,
  updatePartner,
  deletePartner,
  getPartnerStats,
  restorePartner,
  getArchivedPartners,
} = require('../controllers/partnerController');

const { authenticate } = require('../middleware/authMiddleware');
const { checkPermission } = require('../middleware/permissionMiddleware');
const validateRequest = require('../middleware/validateRequest');

const {
  createPartnerValidator,
  updatePartnerValidator,
  partnerIdValidator,
} = require('../validators/partnerValidator');

const router = express.Router();

// Apply authentication to all routes
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
  checkPermission("partners.delete.all"), // Restore often requires delete privileges
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

module.exports = router;