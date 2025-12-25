// routes/supplyCategory.routes.js
import express from "express";
import {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
  initializeDefaultCategories,
  archiveCategory,
  restoreCategory,
} from "../controllers/supplyCategoryController.js";
import { authenticate } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";

const router = express.Router();

// All routes require authentication (Populates req.user.businessId)
router.use(authenticate);

// ============================================
// SPECIAL OPERATIONS
// ============================================

// Initialize default categories (e.g. for new businesses)
router.post(
  "/initialize",
  checkPermission("supplies.create"),
  initializeDefaultCategories
);

// Reorder categories (Kanban/List ordering)
router.patch(
  "/reorder",
  checkPermission("supplies.update.all"),
  reorderCategories
);

// ============================================
// CRUD OPERATIONS
// ============================================

router
  .route("/")
  .get(
    checkPermission("supplies.read.all"),
    getAllCategories
  )
  .post(
    checkPermission("supplies.create"),
    createCategory
  );

router
  .route("/:id")
  .get(
    checkPermission("supplies.read.all"),
    getCategoryById
  )
  .patch(
    checkPermission("supplies.update.all"),
    updateCategory
  )
  .delete(
    checkPermission("supplies.delete.all"),
    deleteCategory
  );

// ============================================
// ARCHIVE OPERATIONS
// ============================================

router.patch(
  "/:id/archive",
  checkPermission("supplies.delete.all"), // Archiving is effectively a soft delete
  archiveCategory
);

router.patch(
  "/:id/restore",
  checkPermission("supplies.update.all"), // Restoring is an update action
  restoreCategory
);

export default router;