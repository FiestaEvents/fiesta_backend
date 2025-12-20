import express from "express";
import {
  createSupply,
  getAllSupplies,
  getSupplyById,
  updateSupply,
  deleteSupply,
  getLowStockSupplies,
  updateStock,
  getStockHistory,
  archiveSupply,
  restoreSupply,
  getSupplyAnalytics,
  getSuppliesByCategory,
} from "../controllers/supplyController.js";
import { authenticate } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";
import validateRequest from "../middleware/validateRequest.js";
import {
  createSupplyValidator,
  updateSupplyValidator,
  supplyIdValidator,
  updateStockValidator,
} from "../validators/supplyValidator.js";

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// ============================================
// ANALYTICS & ALERTS (Static paths first)
// ============================================
router.get(
  "/alerts/low-stock",
  checkPermission("supplies.read.all"),
  getLowStockSupplies
);

router.get(
  "/analytics/summary",
  checkPermission("supplies.read.all"),
  getSupplyAnalytics
);

// Category-specific queries
router.get(
  "/by-category/:categoryId",
  checkPermission("supplies.read.all"),
  // Assuming categoryId needs validation if it's a MongoId
  // categoryIdValidator, 
  // validateRequest,
  getSuppliesByCategory
);

// ============================================
// STOCK OPERATIONS (Sub-routes)
// ============================================
router.patch(
  "/:id/stock",
  checkPermission("supplies.update.all"),
  updateStockValidator,
  validateRequest,
  updateStock
);

router.get(
  "/:id/history",
  checkPermission("supplies.read.all"),
  supplyIdValidator,
  validateRequest,
  getStockHistory
);

// ============================================
// ARCHIVE / RESTORE
// ============================================
router.patch(
  "/:id/archive",
  checkPermission("supplies.delete.all"),
  supplyIdValidator,
  validateRequest,
  archiveSupply
);

router.patch(
  "/:id/restore",
  checkPermission("supplies.update.all"),
  supplyIdValidator,
  validateRequest,
  restoreSupply
);

// ============================================
// MAIN CRUD ROUTES
// ==========================================

router
  .route("/")
  .get(
    checkPermission("supplies.read.all"),
    getAllSupplies
  )
  .post(
    checkPermission("supplies.create"),
    createSupplyValidator,
    validateRequest,
    createSupply
  );

router
  .route("/:id")
  .get(
    checkPermission("supplies.read.all"),
    supplyIdValidator,
    validateRequest,
    getSupplyById
  )
  .put(
    checkPermission("supplies.update.all"),
    updateSupplyValidator,
    validateRequest,
    updateSupply
  )
  .delete(
    checkPermission("supplies.delete.all"),
    supplyIdValidator,
    validateRequest,
    deleteSupply
  );

export default router;