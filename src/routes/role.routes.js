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
import validateRequest from "../middleware/validateRequest.js";
import {
  createRoleValidator,
  updateRoleValidator,
  roleIdValidator,
} from "../validators/roleValidator.js";

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// ==========================================
// STATIC ROUTES (Must come before /:id)
// ==========================================

// Get all available system permissions (for UI selection)
router.get(
  "/permissions",
  checkPermission("roles.read.all"),
  getPermissions
);

// ==========================================
// MAIN CRUD ROUTES
// ==========================================

router
  .route("/")
  .get(
    checkPermission("roles.read.all"),
    getRoles
  )
  .post(
    checkPermission("roles.create"),
    createRoleValidator,
    validateRequest,
    createRole
  );

router
  .route("/:id")
  .get(
    checkPermission("roles.read.all"),
    roleIdValidator,
    validateRequest,
    getRole
  )
  .put(
    checkPermission("roles.update.all"),
    updateRoleValidator,
    validateRequest,
    updateRole
  )
  .delete(
    checkPermission("roles.delete.all"),
    roleIdValidator,
    validateRequest,
    deleteRole
  );

export default router;