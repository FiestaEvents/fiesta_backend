import express from "express";
import { authenticate } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";
import validateRequest from "../middleware/validateRequest.js";
import {
  getInvoiceSettings,
  updateInvoiceSettings,
  previewInvoice,
  applyTemplate,
  resetToDefaults,
} from "../controllers/invoiceSettingsController.js";
import { invoiceSettingsValidator } from "../validators/invoiceValidator.js";

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// ==========================================
// SETTINGS CRUD
// ==========================================

// Get Settings
router.get(
  "/",
  checkPermission("venue.read"), // Settings are usually venue-level
  getInvoiceSettings
);

// Update Settings
router.put(
  "/",
  checkPermission("venue.update"),
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
  checkPermission("venue.read"),
  invoiceSettingsValidator, // Validate payload before previewing
  validateRequest,
  previewInvoice
);

// Apply a specific template style
router.post(
  "/apply-template",
  checkPermission("venue.update"),
  applyTemplate
);

// Reset to system defaults
router.post(
  "/reset",
  checkPermission("venue.update"),
  resetToDefaults
);

export default router;