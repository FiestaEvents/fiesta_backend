import express from "express";
import {
  getPayments,
  getPayment,
  createPayment,
  updatePayment,
  deletePayment,
  getPaymentStats,
  processRefund,
} from "../controllers/paymentController.js";
import { authenticate } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";
import validateRequest from "../middleware/validateRequest.js";
import {
  createPaymentValidator,
  updatePaymentValidator,
} from "../validators/paymentValidator.js";
import { param } from "express-validator";

const router = express.Router();

router.use(authenticate);

// Stats
router.get("/stats", checkPermission("payments.read.all"), getPaymentStats);

// Refund
router.post(
  "/:id/refund",
  checkPermission("payments.update.all"),
  param("id").isMongoId(),
  validateRequest,
  processRefund
);

// CRUD operations
router
  .route("/")
  .get(checkPermission("payments.read.all"), getPayments)
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
    param("id").isMongoId(),
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
    param("id").isMongoId(),
    validateRequest,
    deletePayment
  );

export default router;