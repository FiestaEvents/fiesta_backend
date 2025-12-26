import express from "express";
import {
  getInvoiceSettings,
  updateInvoiceSettings,
  previewInvoice,
  applyTemplate,
  resetToDefaults,
} from "../controllers/invoiceSettingsController.js";

import { authenticate } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";
import validateRequest from "../middleware/validateRequest.js";
import { invoiceSettingsValidator } from "../validators/invoiceValidator.js";

const router = express.Router();

// Apply authentication to all routes (Populates req.user.businessId)
router.use(authenticate);

// ==========================================
// SETTINGS CRUD
// ==========================================

// Get Settings
router.get(
  "/",
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
  invoiceSettingsValidator,
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

export default router;