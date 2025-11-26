// routes/contract.routes.js
import express from "express";
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
  
  // Workflow Actions
  sendContract,
  markContractViewed,
  signContract,
  duplicateContract,
  downloadContractPdf, // ✅ Added
  
  // Settings & Stats
  getContractSettings,
  updateContractSettings,
  getContractStats,
} from "../controllers/contractController.js";

import { authenticate } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";

const router = express.Router();

// =================================================================
// MIDDLEWARE
// =================================================================
// All routes require login. Specific permissions are checked per route.
router.use(authenticate);

// =================================================================
// 1. STATIC ROUTES (Must come before /:id)
// =================================================================

// Contract Global Settings (Branding, Defaults, Tax Info)
router.route("/settings")
  .get(
    checkPermission("settings", "read"), 
    getContractSettings
  )
  .put(
    checkPermission("settings", "manage"), 
    updateContractSettings
  );

// Dashboard Statistics
router.get(
  "/stats", 
  checkPermission("finance", "read"), 
  getContractStats
);

// =================================================================
// 2. GENERAL CRUD (Root)
// =================================================================

router.route("/")
  .get(
    checkPermission("finance", "read"), 
    getContracts
  )
  .post(
    checkPermission("finance", "create"), 
    createContract
  );

// =================================================================
// 3. SPECIFIC ACTIONS (ID based, but specific paths)
// =================================================================

// PDF Download
router.get(
  "/:id/download",
  checkPermission("finance", "read"),
  downloadContractPdf
);

// Archiving
router.patch(
  "/:id/archive", 
  checkPermission("finance", "update"), 
  archiveContract
);

router.patch(
  "/:id/restore", 
  checkPermission("finance", "update"), 
  restoreContract
);

// Workflow: Duplicate
router.post(
  "/:id/duplicate", 
  checkPermission("finance", "create"), 
  duplicateContract
);

// Workflow: Send
router.post(
  "/:id/send", 
  checkPermission("finance", "update"), 
  sendContract
);

// External Interactions (View/Sign)
// Note: If these are accessed by the client via a public link, 
// they should be moved to a public router without 'authenticate' middleware.
router.patch(
  "/:id/view", 
  markContractViewed
);

router.post(
  "/:id/sign", 
  signContract
);

// =================================================================
// 4. SINGLE CONTRACT OPERATIONS (General /:id)
// =================================================================

router.route("/:id")
  .get(
    checkPermission("finance", "read"), 
    getContractById
  )
  .put(
    checkPermission("finance", "update"), 
    updateContract
  )
  .delete(
    checkPermission("finance", "delete"), 
    deleteContract
  );

export default router;