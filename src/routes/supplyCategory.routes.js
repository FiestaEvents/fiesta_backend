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
import { authenticate, authorize  } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// ============================================
// SPECIAL OPERATIONS (must be before /:id)
// ============================================
router.post("/initialize", authorize ("owner"), initializeDefaultCategories);
router.patch("/reorder", authorize ("owner", "manager"), reorderCategories);

// ============================================
// CRUD OPERATIONS
// ============================================
router.route("/")
  .get(getAllCategories)
  .post(authorize ("owner", "manager"), createCategory);

router.route("/:id")
  .get(getCategoryById)
  .patch(authorize ("owner", "manager"), updateCategory)
  .delete(authorize ("owner"), deleteCategory);

// ============================================
// ARCHIVE OPERATIONS
// ============================================
router.patch("/:id/archive", authorize ("owner", "manager"), archiveCategory);
router.patch("/:id/restore", authorize ("owner"), restoreCategory);

export default router;