// src/routes/invoiceRoutes.js
const express = require('express');
const {
  getAllInvoices, 
  createInvoice, 
  getInvoiceById, 
  updateInvoice, 
  deleteInvoice,
  getInvoiceStats, 
  downloadInvoice, 
  sendInvoice, 
  markAsPaid, 
  cancelInvoice
} = require('../controllers/invoiceController');

const {
  getInvoiceSettings, 
  updateInvoiceSettings,
  previewInvoice, 
  resetToDefaults, 
  applyTemplate
} = require('../controllers/invoiceSettingsController');

const { authenticate } = require('../middleware/authMiddleware');
const { checkPermission } = require('../middleware/permissionMiddleware');
const validateRequest = require('../middleware/validateRequest');

const {
  createInvoiceValidator,
  updateInvoiceValidator,
  invoiceIdValidator,
  invoiceSettingsValidator,
} = require('../validators/invoiceValidator');

const router = express.Router();

// Apply Middleware
router.use(authenticate);

// ====================================================
// 1. SETTINGS (Static paths first)
// ====================================================
router.route("/settings")
  .get(
    // Updated permission to match new Business Architecture
    checkPermission("business.read"), 
    getInvoiceSettings
  )
  .put(
    checkPermission("business.update"),
    invoiceSettingsValidator,
    validateRequest,
    updateInvoiceSettings
  );

router.post(
  "/settings/preview",
  checkPermission("business.read"),
  invoiceSettingsValidator,
  validateRequest,
  previewInvoice
);

router.post(
  "/settings/reset",
  checkPermission("business.update"),
  resetToDefaults
);

router.post(
  "/settings/apply-template",
  checkPermission("business.update"),
  applyTemplate
);

// ====================================================
// 2. STATS
// ====================================================
router.get(
  "/stats",
  checkPermission("finance.read.all"),
  getInvoiceStats
);

// ====================================================
// 3. GENERAL CRUD
// ====================================================
router.route("/")
  .get(
    checkPermission("finance.read.all"),
    getAllInvoices
  )
  .post(
    checkPermission("finance.create"),
    createInvoiceValidator,
    validateRequest,
    createInvoice
  );

// ====================================================
// 4. INVOICE ACTIONS
// ====================================================
router.get(
  "/:id/download",
  checkPermission("finance.read.all"),
  invoiceIdValidator,
  validateRequest,
  downloadInvoice
);

router.post(
  "/:id/send",
  checkPermission("finance.update.all"),
  invoiceIdValidator,
  validateRequest,
  sendInvoice
);

router.post(
  "/:id/mark-paid",
  checkPermission("payments.create"), // Paying an invoice creates a payment
  invoiceIdValidator,
  validateRequest,
  markAsPaid
);

router.post(
  "/:id/cancel",
  checkPermission("finance.update.all"),
  invoiceIdValidator,
  validateRequest,
  cancelInvoice
);

// ====================================================
// 5. SINGLE INVOICE OPERATIONS
// ====================================================
router.route("/:id")
  .get(
    checkPermission("finance.read.all"),
    invoiceIdValidator,
    validateRequest,
    getInvoiceById
  )
  .put(
    checkPermission("finance.update.all"),
    updateInvoiceValidator,
    validateRequest,
    updateInvoice
  )
  .delete(
    checkPermission("finance.delete.all"),
    invoiceIdValidator,
    validateRequest,
    deleteInvoice
  );

module.exports = router;