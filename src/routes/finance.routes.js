import express from "express";
import {
  getFinanceRecords,
  getFinanceRecord,
  createFinanceRecord,
  updateFinanceRecord,
  deleteFinanceRecord,
  getFinancialSummary,
  getCashFlowReport,
  getExpenseBreakdown,
  getIncomeBreakdown,
  getProfitLossStatement,
  getFinancialTrends,
  getTaxSummary,
  restoreFinanceRecord,
  getArchivedFinanceRecords,
} from "../controllers/financeController.js";

import { authenticate } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";
import validateRequest from "../middleware/validateRequest.js";

import {
  createFinanceValidator,
  updateFinanceValidator,
  financeIdValidator,
} from "../validators/financeValidator.js";

const router = express.Router();

// Apply authentication to all routes (Populates req.user.businessId)
router.use(authenticate);

// ==========================================
// REPORTS & ANALYTICS (Static Routes)
// ==========================================
router.get(
  "/summary",
  checkPermission("finance.read.all"),
  getFinancialSummary
);

router.get(
  "/cashflow",
  checkPermission("finance.read.all"),
  getCashFlowReport
);

router.get(
  "/expenses/breakdown",
  checkPermission("finance.read.all"),
  getExpenseBreakdown
);

router.get(
  "/income/breakdown",
  checkPermission("finance.read.all"),
  getIncomeBreakdown
);

router.get(
  "/profit-loss",
  checkPermission("finance.read.all"),
  getProfitLossStatement
);

router.get(
  "/trends",
  checkPermission("finance.read.all"),
  getFinancialTrends
);

router.get(
  "/tax-summary",
  checkPermission("finance.read.all"),
  getTaxSummary
);

// ==========================================
// ARCHIVE MANAGEMENT
// ==========================================
router.get(
  "/archived",
  checkPermission("finance.read.all"),
  getArchivedFinanceRecords
);

// Restore logic (Moved before generic /:id to prevent collision)
router.patch(
  "/:id/restore",
  checkPermission("finance.delete.all"), 
  financeIdValidator,
  validateRequest,
  restoreFinanceRecord
);

// ==========================================
// CRUD OPERATIONS
// ==========================================

router
  .route("/")
  .get(
    checkPermission("finance.read.all"),
    getFinanceRecords
  )
  .post(
    checkPermission("finance.create"),
    createFinanceValidator,
    validateRequest,
    createFinanceRecord
  );

router
  .route("/:id")
  .get(
    checkPermission("finance.read.all"),
    financeIdValidator,
    validateRequest,
    getFinanceRecord
  )
  .put(
    checkPermission("finance.update.all"),
    updateFinanceValidator,
    validateRequest,
    updateFinanceRecord
  )
  .delete(
    checkPermission("finance.delete.all"),
    financeIdValidator,
    validateRequest,
    deleteFinanceRecord
  );

export default router;