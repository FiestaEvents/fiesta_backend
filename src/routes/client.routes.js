// src/routes/clientRoutes.js
const express = require('express');
const {
  getClients,
  getClient,
  createClient,
  updateClient,
  archiveClient,
  restoreClient,
  getArchivedClients,
  getClientStats,
} = require('../controllers/clientController');

const { authenticate } = require('../middleware/authMiddleware');
const { checkPermission } = require('../middleware/permissionMiddleware');
const validateRequest = require('../middleware/validateRequest');

const {
  createClientValidator,
  updateClientValidator,
  getClientValidator,
} = require('../validators/clientValidator');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// ==========================================
// STATIC ROUTES (Must come before /:id)
// ==========================================

// Stats
router.get(
  "/stats", 
  checkPermission("clients.read.all"), 
  getClientStats
);

// Archived List
router.get(
  "/archived", 
  checkPermission("clients.read.all"), 
  getArchivedClients
);

// ==========================================
// MAIN ROUTES
// ==========================================

router
  .route("/")
  .get(
    checkPermission("clients.read.all"), 
    getClients
  )
  .post(
    checkPermission("clients.create"),
    createClientValidator,
    validateRequest,
    createClient
  );

// ==========================================
// DYNAMIC ROUTES (/:id)
// ==========================================

// Restore Client
router.patch(
  "/:id/restore",
  checkPermission("clients.delete.all"),
  getClientValidator, // Validates ID
  validateRequest,
  restoreClient
);

// Single Client Operations
router
  .route("/:id")
  .get(
    checkPermission("clients.read.all"),
    getClientValidator,
    validateRequest,
    getClient
  )
  .put(
    checkPermission("clients.update.all"),
    updateClientValidator,
    validateRequest,
    updateClient
  )
  .delete(
    checkPermission("clients.delete.all"),
    getClientValidator,
    validateRequest,
    archiveClient
  );

module.exports = router;