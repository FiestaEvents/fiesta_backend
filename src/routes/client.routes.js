import express from "express";
import {
  getClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
  getClientStats,
} from "../controllers/clientController.js";
import { authenticate } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";
import validateRequest from "../middleware/validateRequest.js";
import {
  createClientValidator,
  updateClientValidator,
  getClientValidator,
} from "../validators/clientValidator.js";

const router = express.Router();

router.use(authenticate);

// Stats
router.get("/stats", checkPermission("clients.read.all"), getClientStats);

// CRUD operations
router
  .route("/")
  .get(checkPermission("clients.read.all"), getClients)
  .post(
    checkPermission("clients.create"),
    createClientValidator,
    validateRequest,
    createClient
  );

router
  .route("/:id")
  .get(
    checkPermission("clients.read.all"),
    getClientValidator,
    validateRequest,
    getClient
  )
  .put(
    checkPermission("clients.update.all"),
    updateClientValidator,
    validateRequest,
    updateClient
  )
  .delete(
    checkPermission("clients.delete.all"),
    getClientValidator,
    validateRequest,
    deleteClient
  );

export default router;