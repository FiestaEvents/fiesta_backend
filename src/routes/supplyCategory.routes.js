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

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// ============================================
// SPECIAL OPERATIONS
// ============================================
router.post(
  "/initialize",
  initializeDefaultCategories
);
router.patch(
  "/reorder",
  reorderCategories
);

// ============================================
// CRUD OPERATIONS
// ============================================
router
  .route("/")
  .get(getAllCategories)
  .post( createCategory);

router
  .route("/:id")
  .get(getCategoryById)
  .patch(updateCategory)
  .delete(deleteCategory);

// ============================================
// ARCHIVE OPERATIONS
// ============================================
router.patch(
  "/:id/archive",
  archiveCategory
);
router.patch("/:id/restore", restoreCategory);

export default router;
