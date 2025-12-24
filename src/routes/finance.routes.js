// src/routes/financeRoutes.js
const express = require('express');
const {
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
} = require('../controllers/financeController');

const { authenticate } = require('../middleware/authMiddleware');
const { checkPermission } = require('../middleware/permissionMiddleware');
const validateRequest = require('../middleware/validateRequest');

const {
  createFinanceValidator,
  updateFinanceValidator,
  financeIdValidator,
} = require('../validators/financeValidator');

const router = express.Router();

// Apply authentication to all routes
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
  checkPermission("finance.delete.all"), // Using delete permission as it reverses archiving
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

module.exports = router;