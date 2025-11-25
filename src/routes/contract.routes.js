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
// 1. STATIC ROUTES (Must be before /:id)
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
// 2. GENERAL CRUD
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
// 3. SINGLE CONTRACT OPERATIONS (Dynamic :id)
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

// =================================================================
// 4. SPECIFIC ACTIONS
// =================================================================

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

// Workflow
router.post(
  "/:id/duplicate", 
  checkPermission("finance", "create"), 
  duplicateContract
);

router.post(
  "/:id/send", 
  checkPermission("finance", "update"), 
  sendContract
);

// External Interactions (View/Sign)
// Note: 'view' and 'sign' might logically be accessed by the Client via a public link later.
// For now, if accessed via the app API, we keep authentication.
router.patch(
  "/:id/view", 
  markContractViewed
);

router.post(
  "/:id/sign", 
  signContract
);

export default router;