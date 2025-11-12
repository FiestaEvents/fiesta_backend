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
import { param, body } from "express-validator";
import validateRequest from "../middleware/validateRequest.js";

const router = express.Router();

router.use(authenticate);

// Reports and analytics
router.get("/summary", checkPermission("finance.read.all"), getFinancialSummary);
router.get("/cashflow", checkPermission("finance.read.all"), getCashFlowReport);
router.get("/expenses/breakdown", checkPermission("finance.read.all"), getExpenseBreakdown);
router.get("/income/breakdown", checkPermission("finance.read.all"), getIncomeBreakdown);
router.get("/profit-loss", checkPermission("finance.read.all"), getProfitLossStatement);
router.get("/trends", checkPermission("finance.read.all"), getFinancialTrends);
router.get("/tax-summary", checkPermission("finance.read.all"), getTaxSummary);

// Archived records
router.get("/archived", checkPermission("finance.read.all"), getArchivedFinanceRecords);

// Restore archived record
router.patch(
  "/:id/restore",
  checkPermission("finance.update.all"),
  param("id").isMongoId(),
  validateRequest,
  restoreFinanceRecord
);

// CRUD operations
router
  .route("/")
  .get(checkPermission("finance.read.all"), getFinanceRecords)
  .post(
    checkPermission("finance.create"),
    body("type").isIn(["income", "expense"]).withMessage("Invalid type"),
    body("category").notEmpty().withMessage("Category is required"),
    body("description").notEmpty().withMessage("Description is required"),
    body("amount").isFloat({ min: 0 }).withMessage("Amount must be a positive number"),
    body("date").isISO8601().withMessage("Invalid date format"),
    validateRequest,
    createFinanceRecord
  );

router
  .route("/:id")
  .get(
    checkPermission("finance.read.all"),
    param("id").isMongoId(),
    validateRequest,
    getFinanceRecord
  )
  .put(
    checkPermission("finance.update.all"),
    param("id").isMongoId(),
    validateRequest,
    updateFinanceRecord
  )
  .delete(
    checkPermission("finance.delete.all"),
    param("id").isMongoId(),
    validateRequest,
    deleteFinanceRecord
  );

export default router;