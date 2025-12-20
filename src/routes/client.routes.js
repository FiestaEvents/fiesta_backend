import express from "express";
import {
  getClients,
  getClient,
  createClient,
  updateClient,
  archiveClient,
  restoreClient,
  getArchivedClients,
  getClientStats,
} from "../controllers/clientController.js";
import { authenticate } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";
import validateRequest from "../middleware/validateRequest.js";
import {
  createClientValidator,
  updateClientValidator,
  getClientValidator, // Used for ID validation on GET/DELETE/RESTORE
} from "../validators/clientValidator.js";

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
    getClients // Add getClientsValidator if you have query params validation
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
  checkPermission("clients.delete.all"), // Usually requires same perm as archive
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

export default router;