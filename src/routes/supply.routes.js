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

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// Alerts & Analytics
router.get("/alerts/low-stock", getLowStockSupplies);
router.get("/analytics/summary", getSupplyAnalytics);

// Category-based queries
router.get("/by-category/:categoryId", getSuppliesByCategory);

// ============================================
// CRUD Operations
// ============================================
router.route("/")
  .get(getAllSupplies)
  // Allow both "Owner" and "owner" to handle case sensitivity issues
  .post(createSupply);

router.route("/:id")
  .get(getSupplyById)
  // ✅ FIX: Added "Owner" and "Manager" to allowed roles
  .patch(updateSupply)
  .delete(deleteSupply);

// Stock Management
router.patch(
  "/:id/stock",
  updateStock
);
router.get("/:id/history", getStockHistory);

// Archive Operations
router.patch(
  "/:id/archive",
  archiveSupply
);
router.patch(
  "/:id/restore",
  restoreSupply
);

export default router;