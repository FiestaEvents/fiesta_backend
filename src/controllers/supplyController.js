import mongoose from "mongoose"; // ✅ ADDED: Missing import
import { Supply } from "../models/index.js";
import asyncHandler from "express-async-handler";

// @desc    Create new supply item
// @route   POST /api/supplies
// @access  Private (Owner, Manager)
export const createSupply = asyncHandler(async (req, res) => {
  // Validate category exists and belongs to venue
  const SupplyCategory = mongoose.model("SupplyCategory");
  const category = await SupplyCategory.findOne({
    _id: req.body.categoryId,
    venueId: req.user.venueId,
  });

  if (!category) {
    res.status(400);
    throw new Error("Invalid category or category does not belong to your venue");
  }

  const supply = await Supply.create({
    ...req.body,
    venueId: req.user.venueId,
    createdBy: req.user._id,
  });

  // Populate category before sending response
  await supply.populate("categoryId");

  res.status(201).json({
    success: true,
    supply: supply, // ✅ Changed from 'data' to 'supply' for consistency
  });
});

// @desc    Get all supplies for venue
// @route   GET /api/supplies?categoryId=xxx&status=active&search=xxx
// @access  Private
export const getAllSupplies = asyncHandler(async (req, res) => {
  const { categoryId, status, lowStock, search, includeArchived } = req.query;

  // ✅ Base query - exclude archived by default
  let query = { 
    venueId: req.user.venueId,
    isArchived: includeArchived === "true" ? { $in: [true, false] } : false
  };

  // Filters
  if (categoryId) query.categoryId = categoryId;
  if (status) query.status = status;
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { "supplier.name": { $regex: search, $options: "i" } },
      { notes: { $regex: search, $options: "i" } },
    ];
  }

  let suppliesQuery = Supply.find(query).populate("categoryId");

  // Low stock filter
  if (lowStock === "true") {
    suppliesQuery = suppliesQuery.where({
      $expr: { $lte: ["$currentStock", "$minimumStock"] },
    });
  }

  const supplies = await suppliesQuery.sort({ name: 1 });

  res.status(200).json({
    success: true,
    count: supplies.length,
    supplies: supplies, // ✅ Changed from 'data' to 'supplies'
  });
});

// @desc    Get single supply by ID
// @route   GET /api/supplies/:id
// @access  Private
export const getSupplyById = asyncHandler(async (req, res) => {
  const supply = await Supply.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  }).populate("categoryId");

  if (!supply) {
    res.status(404);
    throw new Error("Supply not found");
  }

  res.status(200).json({
    success: true,
    supply: supply,
  });
});

// @desc    Update supply
// @route   PATCH /api/supplies/:id
// @access  Private (Owner, Manager)
export const updateSupply = asyncHandler(async (req, res) => {
  let supply = await Supply.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  });

  if (!supply) {
    res.status(404);
    throw new Error("Supply not found");
  }

  // If category is being updated, validate it
  if (req.body.categoryId && req.body.categoryId !== supply.categoryId.toString()) {
    const SupplyCategory = mongoose.model("SupplyCategory");
    const category = await SupplyCategory.findOne({
      _id: req.body.categoryId,
      venueId: req.user.venueId,
    });

    if (!category) {
      res.status(400);
      throw new Error("Invalid category or category does not belong to your venue");
    }
  }

  // Update supply
  supply = await Supply.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  ).populate("categoryId");

  res.status(200).json({
    success: true,
    supply: supply,
  });
});

// @desc    Delete supply
// @route   DELETE /api/supplies/:id
// @access  Private (Owner)
export const deleteSupply = asyncHandler(async (req, res) => {
  const supply = await Supply.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  });

  if (!supply) {
    res.status(404);
    throw new Error("Supply not found");
  }

  await supply.deleteOne();

  res.status(200).json({
    success: true,
    message: "Supply deleted successfully",
  });
});

// @desc    Get supplies by category
// @route   GET /api/supplies/by-category/:categoryId
// @access  Private
export const getSuppliesByCategory = asyncHandler(async (req, res) => {
  const supplies = await Supply.find({
    venueId: req.user.venueId,
    categoryId: req.params.categoryId,
    isArchived: false,
    status: "active",
  })
    .populate("categoryId")
    .sort({ name: 1 });

  res.status(200).json({
    success: true,
    count: supplies.length,
    supplies: supplies,
  });
});

// @desc    Update stock level
// @route   PATCH /api/supplies/:id/stock
// @access  Private (Owner, Manager, Staff)
export const updateStock = asyncHandler(async (req, res) => {
  const { quantity, type, reference, notes } = req.body;

  if (!quantity || !type) {
    res.status(400);
    throw new Error("Quantity and type are required");
  }

  // Validate type
  const validTypes = ["purchase", "usage", "adjustment", "return", "waste"];
  if (!validTypes.includes(type)) {
    res.status(400);
    throw new Error(`Invalid type. Must be one of: ${validTypes.join(", ")}`);
  }

  const supply = await Supply.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  });

  if (!supply) {
    res.status(404);
    throw new Error("Supply not found");
  }

  // Use the static method from the model
  const updatedSupply = await Supply.updateStock(
    req.params.id,
    quantity,
    type,
    reference,
    req.user._id,
    notes
  );

  await updatedSupply.populate("categoryId");

  res.status(200).json({
    success: true,
    supply: updatedSupply,
  });
});

// @desc    Get stock history
// @route   GET /api/supplies/:id/history
// @access  Private
export const getStockHistory = asyncHandler(async (req, res) => {
  const supply = await Supply.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  }).populate("stockHistory.recordedBy", "name email");

  if (!supply) {
    res.status(404);
    throw new Error("Supply not found");
  }

  // Sort history by date descending (most recent first)
  const history = supply.stockHistory.sort((a, b) => 
    new Date(b.date) - new Date(a.date)
  );

  res.status(200).json({
    success: true,
    count: history.length,
    history: history,
  });
});

// @desc    Get low stock supplies
// @route   GET /api/supplies/alerts/low-stock
// @access  Private
export const getLowStockSupplies = asyncHandler(async (req, res) => {
  const supplies = await Supply.getLowStockItems(req.user.venueId);

  res.status(200).json({
    success: true,
    count: supplies.length,
    supplies: supplies,
  });
});

// @desc    Get supply analytics
// @route   GET /api/supplies/analytics/summary
// @access  Private
export const getSupplyAnalytics = asyncHandler(async (req, res) => {
  const venueId = req.user.venueId;

  const [
    totalSupplies,
    totalValue,
    lowStockCount,
    outOfStockCount,
    categoryBreakdown,
  ] = await Promise.all([
    // Total active supplies
    Supply.countDocuments({ venueId, status: "active", isArchived: false }),

    // Total inventory value
    Supply.aggregate([
      { $match: { venueId, status: "active", isArchived: false } },
      {
        $group: {
          _id: null,
          total: {
            $sum: { $multiply: ["$currentStock", "$costPerUnit"] },
          },
        },
      },
    ]),

    // Low stock items
    Supply.countDocuments({
      venueId,
      status: "active",
      isArchived: false,
      $expr: { $lte: ["$currentStock", "$minimumStock"] },
    }),

    // Out of stock
    Supply.countDocuments({
      venueId,
      status: "out_of_stock",
      isArchived: false,
    }),

    // Breakdown by category
    Supply.aggregate([
      { $match: { venueId, status: "active", isArchived: false } },
      {
        $lookup: {
          from: "supplycategories",
          localField: "categoryId",
          foreignField: "_id",
          as: "category",
        },
      },
      { $unwind: "$category" },
      {
        $group: {
          _id: "$categoryId",
          categoryName: { $first: "$category.name" },
          count: { $sum: 1 },
          totalValue: {
            $sum: { $multiply: ["$currentStock", "$costPerUnit"] },
          },
        },
      },
    ]),
  ]);

  res.status(200).json({
    success: true,
    analytics: {
      totalSupplies,
      totalValue: totalValue[0]?.total || 0,
      lowStockCount,
      outOfStockCount,
      categoryBreakdown,
    },
  });
});

// @desc    Archive supply
// @route   PATCH /api/supplies/:id/archive
// @access  Private (Owner, Manager)
export const archiveSupply = asyncHandler(async (req, res) => {
  const supply = await Supply.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  });

  if (!supply) {
    res.status(404);
    throw new Error("Supply not found");
  }

  if (supply.isArchived) {
    res.status(400);
    throw new Error("Supply is already archived");
  }

  supply.isArchived = true;
  supply.archivedAt = new Date();
  supply.archivedBy = req.user._id;
  supply.status = "inactive";

  await supply.save();
  await supply.populate("categoryId");

  res.status(200).json({
    success: true,
    supply: supply,
    message: "Supply archived successfully",
  });
});

// @desc    Restore archived supply
// @route   PATCH /api/supplies/:id/restore
// @access  Private (Owner)
export const restoreSupply = asyncHandler(async (req, res) => {
  const supply = await Supply.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  });

  if (!supply) {
    res.status(404);
    throw new Error("Supply not found");
  }

  if (!supply.isArchived) {
    res.status(400);
    throw new Error("Supply is not archived");
  }

  supply.isArchived = false;
  supply.archivedAt = null;
  supply.archivedBy = null;
  supply.status = "active";

  await supply.save();
  await supply.populate("categoryId");

  res.status(200).json({
    success: true,
    supply: supply,
    message: "Supply restored successfully",
  });
});