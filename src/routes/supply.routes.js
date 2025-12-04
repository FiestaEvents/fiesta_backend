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
import { authenticate, authorize } from "../middleware/auth.js";

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
  .post(authorize("owner", "Owner", "manager", "Manager"), createSupply);

router.route("/:id")
  .get(getSupplyById)
  // ✅ FIX: Added "Owner" and "Manager" to allowed roles
  .patch(authorize("owner", "Owner", "manager", "Manager"), updateSupply)
  .delete(authorize("owner", "Owner"), deleteSupply);

// Stock Management
router.patch(
  "/:id/stock",
  authorize("owner", "Owner", "manager", "Manager", "staff", "Staff"),
  updateStock
);
router.get("/:id/history", getStockHistory);

// Archive Operations
router.patch(
  "/:id/archive",
  authorize("owner", "Owner", "manager", "Manager"),
  archiveSupply
);
router.patch(
  "/:id/restore",
  authorize("owner", "Owner"),
  restoreSupply
);

export default router;