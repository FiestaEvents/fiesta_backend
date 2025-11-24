import express from "express";
import { authenticate } from "../middleware/auth.js"; // Use authenticate specifically

import {
  getAllInvoices, createInvoice, getInvoiceById, updateInvoice, deleteInvoice,
  getInvoiceStats, downloadInvoice, sendInvoice, markAsPaid, cancelInvoice
} from "../controllers/invoiceController.js";

import {
  getInvoiceSettings, updateInvoiceSettings,
  previewInvoice, resetToDefaults, applyTemplate
} from "../controllers/invoiceSettingsController.js";

const router = express.Router();

// Apply Middleware
router.use(authenticate);

// ====================================================
// 1. SETTINGS & STATS (Static paths first)
// ====================================================
router.get("/settings", getInvoiceSettings);
router.put("/settings", updateInvoiceSettings);
router.post("/settings/preview", previewInvoice);
router.post("/settings/reset", resetToDefaults);
router.post("/settings/apply-template", applyTemplate);

router.get("/stats", getInvoiceStats);

// ====================================================
// 2. GENERAL ROUTES
// ====================================================
router.route("/")
  .get(getAllInvoices)
  .post(createInvoice);

// ====================================================
// 3. ID ROUTES (Dynamic paths last)
// ====================================================
router.get("/:id/download", downloadInvoice);
router.post("/:id/send", sendInvoice);
router.post("/:id/mark-paid", markAsPaid);
router.post("/:id/cancel", cancelInvoice);

router.route("/:id")
  .get(getInvoiceById)
  .put(updateInvoice)
  .delete(deleteInvoice);

export default router;