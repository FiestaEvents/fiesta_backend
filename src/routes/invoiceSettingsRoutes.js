// src/routes/invoiceSettingsRoutes.js
const express = require('express');
const {
  getInvoiceSettings,
  updateInvoiceSettings,
  previewInvoice,
  applyTemplate,
  resetToDefaults,
} = require('../controllers/invoiceSettingsController');

const { authenticate } = require('../middleware/authMiddleware');
const { checkPermission } = require('../middleware/permissionMiddleware');
const validateRequest = require('../middleware/validateRequest');
const { invoiceSettingsValidator } = require('../validators/invoiceValidator');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// ==========================================
// SETTINGS CRUD
// ==========================================

// Get Settings
router.get(
  "/",
  // Updated from venue.read to business.read to match new architecture
  checkPermission("business.read"), 
  getInvoiceSettings
);

// Update Settings
router.put(
  "/",
  checkPermission("business.update"),
  invoiceSettingsValidator,
  validateRequest,
  updateInvoiceSettings
);

// ==========================================
// UTILITY ACTIONS
// ==========================================

// Preview changes (without saving)
router.post(
  "/preview",
  checkPermission("business.read"),
  invoiceSettingsValidator, // Validate payload before previewing
  validateRequest,
  previewInvoice
);

// Apply a specific template style
router.post(
  "/apply-template",
  checkPermission("business.update"),
  applyTemplate
);

// Reset to system defaults
router.post(
  "/reset",
  checkPermission("business.update"),
  resetToDefaults
);

module.exports = router;