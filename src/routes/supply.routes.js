// ============================================
// routes/supply.routes.js - ✅ FIXED ROUTE ORDER
// ============================================
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
import { authenticate, authorize  } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// ============================================
// ⚠️ IMPORTANT: Specific routes MUST come BEFORE /:id
// ============================================

// Alerts & Analytics (BEFORE /:id)
router.get("/alerts/low-stock", getLowStockSupplies);
router.get("/analytics/summary", getSupplyAnalytics);

// Category-based queries (BEFORE /:id)
router.get("/by-category/:categoryId", getSuppliesByCategory);

// ============================================
// CRUD Operations
// ============================================
router.route("/")
  .get(getAllSupplies)
  .post(authorize ("owner", "manager"), createSupply);

// /:id routes come AFTER specific routes
router.route("/:id")
  .get(getSupplyById)
  .patch(authorize ("owner", "manager"), updateSupply)
  .delete(authorize ("owner"), deleteSupply);

// Stock Management (specific actions on /:id)
router.patch("/:id/stock", authorize ("owner", "manager", "staff"), updateStock);
router.get("/:id/history", getStockHistory);

// Archive Operations (specific actions on /:id)
router.patch("/:id/archive", authorize ("owner", "manager"), archiveSupply);
router.patch("/:id/restore", authorize ("owner"), restoreSupply);

export default router;