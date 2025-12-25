// controllers/supplyCategoryController.js
import mongoose from "mongoose";
import { SupplyCategory } from "../models/index.js";
import asyncHandler from "../middleware/asyncHandler.js"; // Ensure correct path to your asyncHandler
import ApiError from "../utils/ApiError.js"; // Standardize error handling if available, otherwise native Error works

/**
 * Helper to safely get Business ID string
 */
const getBusinessId = (user) => {
  if (!user || !user.businessId) return null;
  return user.businessId._id ? user.businessId._id : user.businessId;
};

// ============================================
// CRUD OPERATIONS
// ============================================

// @desc    Get all supply categories for business
// @route   GET /api/supply-categories
// @access  Private
export const getAllCategories = asyncHandler(async (req, res) => {
  const { status, includeArchived } = req.query;
  const businessId = getBusinessId(req.user);

  // Base query - exclude archived by default
  let query = { 
    businessId,
    isArchived: includeArchived === "true" ? { $in: [true, false] } : false
  };

  // Filter by status if provided
  if (status) {
    query.status = status;
  }

  const categories = await SupplyCategory.find(query)
    .sort({ order: 1, name: 1 })
    .lean();

  res.status(200).json({
    success: true,
    count: categories.length,
    categories: categories,
  });
});

// @desc    Get single category by ID
// @route   GET /api/supply-categories/:id
// @access  Private
export const getCategoryById = asyncHandler(async (req, res) => {
  const businessId = getBusinessId(req.user);

  const category = await SupplyCategory.findOne({
    _id: req.params.id,
    businessId,
  });

  if (!category) {
    res.status(404);
    throw new Error("Category not found");
  }

  res.status(200).json({
    success: true,
    category: category,
  });
});

// @desc    Create new category
// @route   POST /api/supply-categories
// @access  Private (Owner, Manager, Chef, etc.)
export const createCategory = asyncHandler(async (req, res) => {
  const { name, nameAr, nameFr, description, icon, color, order } = req.body;
  const businessId = getBusinessId(req.user);

  // Validate required fields
  if (!name || name.trim() === "") {
    res.status(400);
    throw new Error("Category name is required");
  }

  // Check if category with same name already exists (case-insensitive) in this business
  const existingCategory = await SupplyCategory.findOne({
    businessId,
    name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
  });

  if (existingCategory) {
    res.status(400);
    throw new Error("A category with this name already exists");
  }

  // Get the highest order number and increment
  const maxOrderCategory = await SupplyCategory.findOne({
    businessId,
  })
    .sort({ order: -1 })
    .select("order");

  const nextOrder = order !== undefined ? order : (maxOrderCategory?.order || 0) + 1;

  // Create category
  const category = await SupplyCategory.create({
    name: name.trim(),
    nameAr: nameAr?.trim(),
    nameFr: nameFr?.trim(),
    description: description?.trim(),
    icon: icon || "Package",
    color: color || "#F18237",
    order: nextOrder,
    businessId,
    createdBy: req.user._id,
    isDefault: false,
  });

  res.status(201).json({
    success: true,
    category: category,
  });
});

// @desc    Update category
// @route   PATCH /api/supply-categories/:id
// @access  Private
export const updateCategory = asyncHandler(async (req, res) => {
  const businessId = getBusinessId(req.user);

  let category = await SupplyCategory.findOne({
    _id: req.params.id,
    businessId,
  });

  if (!category) {
    res.status(404);
    throw new Error("Category not found");
  }

  // Prevent renaming default system categories
  if (category.isDefault && req.body.name && req.body.name !== category.name) {
    res.status(400);
    throw new Error("Cannot rename default system categories. You can customize other properties.");
  }

  // Check for duplicate name if name is being changed
  if (req.body.name && req.body.name !== category.name) {
    const duplicate = await SupplyCategory.findOne({
      businessId,
      name: { $regex: new RegExp(`^${req.body.name.trim()}$`, "i") },
      _id: { $ne: req.params.id },
    });

    if (duplicate) {
      res.status(400);
      throw new Error("A category with this name already exists");
    }
  }

  // Trim string fields
  if (req.body.name) req.body.name = req.body.name.trim();
  if (req.body.nameAr) req.body.nameAr = req.body.nameAr.trim();
  if (req.body.nameFr) req.body.nameFr = req.body.nameFr.trim();
  if (req.body.description) req.body.description = req.body.description.trim();

  // Update category
  category = await SupplyCategory.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );

  res.status(200).json({
    success: true,
    category: category,
  });
});

// @desc    Delete category
// @route   DELETE /api/supply-categories/:id
// @access  Private
export const deleteCategory = asyncHandler(async (req, res) => {
  const businessId = getBusinessId(req.user);

  const category = await SupplyCategory.findOne({
    _id: req.params.id,
    businessId,
  });

  if (!category) {
    res.status(404);
    throw new Error("Category not found");
  }

  // Prevent deletion of default categories
  if (category.isDefault) {
    res.status(400);
    throw new Error("Cannot delete default system categories. Archive it instead.");
  }

  // Check if any supplies are using this category
  const Supply = mongoose.model("Supply");
  
  // Note: We check specifically for supplies in this category. 
  // Since categories are business-scoped, checking by categoryId is implicitly safe, 
  // but we assume Supply logic also scopes to business.
  const suppliesCount = await Supply.countDocuments({
    categoryId: req.params.id,
    isArchived: false,
  });

  if (suppliesCount > 0) {
    res.status(400);
    throw new Error(
      `Cannot delete category. ${suppliesCount} active ${suppliesCount === 1 ? 'supply is' : 'supplies are'} using this category. Please reassign or archive supplies first.`
    );
  }

  await category.deleteOne();

  res.status(200).json({
    success: true,
    message: "Category deleted successfully",
  });
});

// ============================================
// SPECIAL OPERATIONS
// ============================================

// @desc    Reorder categories
// @route   PATCH /api/supply-categories/reorder
// @access  Private
export const reorderCategories = asyncHandler(async (req, res) => {
  const { categories } = req.body; // Array of { id, order }
  const businessId = getBusinessId(req.user);

  if (!Array.isArray(categories) || categories.length === 0) {
    res.status(400);
    throw new Error("Categories array is required with format: [{ id, order }]");
  }

  // Validate all categories belong to the business
  const categoryIds = categories.map((cat) => cat.id);
  const businessCategories = await SupplyCategory.find({
    _id: { $in: categoryIds },
    businessId,
  });

  if (businessCategories.length !== categories.length) {
    res.status(400);
    throw new Error("Some categories do not belong to your business or do not exist");
  }

  // Update all categories in bulk
  const bulkOps = categories.map((cat) => ({
    updateOne: {
      filter: { _id: cat.id, businessId },
      update: { $set: { order: cat.order } },
    },
  }));

  await SupplyCategory.bulkWrite(bulkOps);

  // Fetch updated categories
  const updatedCategories = await SupplyCategory.find({
    businessId,
    isArchived: false,
  }).sort({ order: 1, name: 1 });

  res.status(200).json({
    success: true,
    count: updatedCategories.length,
    categories: updatedCategories,
    message: "Categories reordered successfully",
  });
});

// @desc    Initialize default categories for business
// @route   POST /api/supply-categories/initialize
// @access  Private
export const initializeDefaultCategories = asyncHandler(async (req, res) => {
  const businessId = getBusinessId(req.user);

  // Check if categories already exist
  const existingCount = await SupplyCategory.countDocuments({
    businessId,
  });

  if (existingCount > 0) {
    res.status(400);
    throw new Error(
      `Categories already exist for this business (${existingCount} categories found). Cannot initialize defaults.`
    );
  }

  // Use the static method from the model to create default categories
  // Note: Ensure SupplyCategory model's initializeDefaults method accepts (businessId, userId)
  const categories = await SupplyCategory.initializeDefaults(
    businessId,
    req.user._id
  );

  res.status(201).json({
    success: true,
    count: categories.length,
    categories: categories,
    message: `${categories.length} default categories initialized successfully`,
  });
});

// ============================================
// ARCHIVE OPERATIONS
// ============================================

// @desc    Archive category
// @route   PATCH /api/supply-categories/:id/archive
// @access  Private
export const archiveCategory = asyncHandler(async (req, res) => {
  const businessId = getBusinessId(req.user);

  const category = await SupplyCategory.findOne({
    _id: req.params.id,
    businessId,
  });

  if (!category) {
    res.status(404);
    throw new Error("Category not found");
  }

  if (category.isArchived) {
    res.status(400);
    throw new Error("Category is already archived");
  }

  // Archive the category
  category.isArchived = true;
  category.archivedAt = new Date();
  category.archivedBy = req.user._id;
  category.status = "inactive";

  await category.save();

  // Optional: Get count of supplies using this category for info message
  const Supply = mongoose.model("Supply");
  const suppliesCount = await Supply.countDocuments({
    categoryId: req.params.id,
    isArchived: false,
  });

  res.status(200).json({
    success: true,
    category: category,
    message: `Category archived successfully. ${suppliesCount > 0 ? `Note: ${suppliesCount} ${suppliesCount === 1 ? 'supply is' : 'supplies are'} still using this category.` : ''}`,
  });
});

// @desc    Restore archived category
// @route   PATCH /api/supply-categories/:id/restore
// @access  Private
export const restoreCategory = asyncHandler(async (req, res) => {
  const businessId = getBusinessId(req.user);

  const category = await SupplyCategory.findOne({
    _id: req.params.id,
    businessId,
  });

  if (!category) {
    res.status(404);
    throw new Error("Category not found");
  }

  if (!category.isArchived) {
    res.status(400);
    throw new Error("Category is not archived");
  }

  // Restore the category
  category.isArchived = false;
  category.archivedAt = null;
  category.archivedBy = null;
  category.status = "active";

  await category.save();

  res.status(200).json({
    success: true,
    category: category,
    message: "Category restored successfully",
  });
});