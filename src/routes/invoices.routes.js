import express from "express";
import {
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
} from "../controllers/invoiceController.js";

import {
  getInvoiceSettings, 
  updateInvoiceSettings,
  previewInvoice, 
  resetToDefaults, 
  applyTemplate
} from "../controllers/invoiceSettingsController.js";

import { authenticate } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";
import validateRequest from "../middleware/validateRequest.js";

import {
  createInvoiceValidator,
  updateInvoiceValidator,
  invoiceIdValidator,
  invoiceSettingsValidator,
} from "../validators/invoiceValidator.js";

const router = express.Router();

// Apply Middleware (Populates req.user.businessId)
router.use(authenticate);

// ====================================================
// 1. SETTINGS (Static paths first)
// ====================================================
router.route("/settings")
  .get(
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
  checkPermission("payments.create"), 
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

export default router;