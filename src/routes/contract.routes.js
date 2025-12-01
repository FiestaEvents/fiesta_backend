import express from "express";
import { authenticate } from "../middleware/auth.js";
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

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// ============================================
// SETTINGS (Must be before /:id routes)
// ============================================
router.route("/settings")
  .get(getContractSettings)
  .put(updateContractSettings);

// ============================================
// STATS (Must be before /:id routes)
// ============================================
router.get("/stats", getContractStats);

// ============================================
// CRUD OPERATIONS
// ============================================
router.route("/")
  .get(getContracts)
  .post(createContract);

router.route("/:id")
  .get(getContractById)
  .put(updateContract)
  .delete(deleteContract);

// ============================================
// ARCHIVE & RESTORE
// ============================================
router.patch("/:id/archive", archiveContract);
router.patch("/:id/restore", restoreContract);

// ============================================
// ACTIONS
// ============================================
router.post("/:id/send", sendContract);
router.post("/:id/duplicate", duplicateContract);
router.patch("/:id/view", markContractViewed);
router.post("/:id/sign", signContract);

// ============================================
// DOWNLOAD PDF
// ============================================
router.get("/:id/download", downloadContractPdf);

export default router;