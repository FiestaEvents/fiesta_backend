// src/routes/paymentRoutes.js
const express = require('express');
const {
  getPayments,
  getPayment,
  createPayment,
  updatePayment,
  deletePayment,
  getPaymentStats,
  processRefund,
  restorePayment,
  getArchivedPayments,
} = require('../controllers/paymentController');

const { authenticate } = require('../middleware/authMiddleware');
const { checkPermission } = require('../middleware/permissionMiddleware');
const validateRequest = require('../middleware/validateRequest');

const {
  createPaymentValidator,
  updatePaymentValidator,
  paymentIdValidator,
} = require('../validators/paymentValidator');

const router = express.Router();

// Apply authentication to all routes
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

module.exports = router;