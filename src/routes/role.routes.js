import express from "express";
import {
  getRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole,
  getPermissions,
} from "../controllers/roleController.js";
import { authenticate } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";
import { param, body } from "express-validator";
import validateRequest from "../middleware/validateRequest.js";

const router = express.Router();

router.use(authenticate);

// Permissions
router.get("/permissions", checkPermission("roles.read.all"), getPermissions);

// CRUD operations
router
  .route("/")
  .get(checkPermission("roles.read.all"), getRoles)
  .post(
    checkPermission("roles.create"),
    body("name").notEmpty().withMessage("Role name is required"),
    body("permissionIds").isArray().withMessage("Permissions must be an array"),
    validateRequest,
    createRole
  );

router
  .route("/:id")
  .get(
    checkPermission("roles.read.all"),
    param("id").isMongoId(),
    validateRequest,
    getRole
  )
  .put(
    checkPermission("roles.update.all"),
    param("id").isMongoId(),
    validateRequest,
    updateRole
  )
  .delete(
    checkPermission("roles.delete.all"),
    param("id").isMongoId(),
    validateRequest,
    deleteRole
  );

export default router;