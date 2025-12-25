import express from "express";
import {
  getPayments,
  getPayment,
  createPayment,
  updatePayment,
  deletePayment,
  getPaymentStats,
  processRefund,
  restorePayment,
  getArchivedPayments,
} from "../controllers/paymentController.js";

import { authenticate } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";
import validateRequest from "../middleware/validateRequest.js";

import {
  createPaymentValidator,
  updatePaymentValidator,
  paymentIdValidator,
} from "../validators/paymentValidator.js";

const router = express.Router();

// Apply authentication to all routes (Populates req.user.businessId)
router.use(authenticate);

// ==========================================
// STATIC ROUTES (Must come before /:id)
// ==========================================

// Stats
router.get(
  "/stats",
  checkPermission("payments.read.all"),
  getPaymentStats
);

// Archived Payments
router.get(
  "/archived",
  checkPermission("payments.read.all"),
  getArchivedPayments
);

// ==========================================
// SPECIFIC ACTIONS (Dynamic)
// ==========================================

// Process Refund
router.post(
  "/:id/refund",
  checkPermission("payments.update.all"),
  paymentIdValidator,
  validateRequest,
  processRefund
);

// Restore Archived Payment
router.patch(
  "/:id/restore",
  checkPermission("payments.delete.all"), // Restore typically aligns with delete permissions
  paymentIdValidator,
  validateRequest,
  restorePayment
);

// ==========================================
// MAIN CRUD ROUTES
// ==========================================

router
  .route("/")
  .get(
    checkPermission("payments.read.all"), 
    getPayments
  )
  .post(
    checkPermission("payments.create"),
    createPaymentValidator,
    validateRequest,
    createPayment
  );

router
  .route("/:id")
  .get(
    checkPermission("payments.read.all"),
    paymentIdValidator,
    validateRequest,
    getPayment
  )
  .put(
    checkPermission("payments.update.all"),
    updatePaymentValidator,
    validateRequest,
    updatePayment
  )
  .delete(
    checkPermission("payments.delete.all"),
    paymentIdValidator,
    validateRequest,
    deletePayment
  );

export default router;