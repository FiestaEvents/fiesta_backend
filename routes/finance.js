import express from "express"
import Finance from "../models/Finance.js"
import { asyncHandler } from "../middleware/errorHandler.js"
import { checkPermission } from "../middleware/auth.js"

const router = express.Router()

// @desc    Get all finance records
// @route   GET /api/finance
// @access  Private
router.get(
  "/",
  checkPermission("finance", "view"),
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, type, category, startDate, endDate, sortBy = "date", sortOrder = "desc" } = req.query

    const query = { venueId: req.user.venueId }

    // Filter by type (income/expense)
    if (type) {
      query.type = type
    }

    // Filter by category
    if (category) {
      query.category = category
    }

    // Date range filter
    if (startDate || endDate) {
      query.date = {}
      if (startDate) query.date.$gte = new Date(startDate)
      if (endDate) query.date.$lte = new Date(endDate)
    }

    const sortOptions = {}
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1

    const records = await Finance.find(query)
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate("relatedEvent", "title type startDate")
      .populate("relatedPartner", "name company")
      .populate("createdBy", "name")

    const total = await Finance.countDocuments(query)

    res.json({
      records,
      pagination: {
        current: Number.parseInt(page),
        pages: Math.ceil(total / limit),
        total,
        limit: Number.parseInt(limit),
      },
    })
  }),
)

// @desc    Get single finance record
// @route   GET /api/finance/:id
// @access  Private
router.get(
  "/:id",
  checkPermission("finance", "view"),
  asyncHandler(async (req, res) => {
    const record = await Finance.findOne({
      _id: req.params.id,
      venueId: req.user.venueId,
    })
      .populate("relatedEvent")
      .populate("relatedPartner")
      .populate("createdBy", "name email")

    if (!record) {
      return res.status(404).json({ message: "Finance record not found" })
    }

    res.json({ record })
  }),
)

// @desc    Create new finance record
// @route   POST /api/finance
// @access  Private
router.post(
  "/",
  checkPermission("finance", "create"),
  asyncHandler(async (req, res) => {
    const recordData = {
      ...req.body,
      venueId: req.user.venueId,
      createdBy: req.user._id,
    }

    const record = new Finance(recordData)
    await record.save()

    await record.populate("relatedEvent", "title")
    await record.populate("relatedPartner", "name")

    res.status(201).json({
      message: "Finance record created successfully",
      record,
    })
  }),
)

// @desc    Update finance record
// @route   PUT /api/finance/:id
// @access  Private
router.put(
  "/:id",
  checkPermission("finance", "edit"),
  asyncHandler(async (req, res) => {
    const record = await Finance.findOne({
      _id: req.params.id,
      venueId: req.user.venueId,
    })

    if (!record) {
      return res.status(404).json({ message: "Finance record not found" })
    }

    Object.assign(record, req.body)
    await record.save()

    res.json({
      message: "Finance record updated successfully",
      record,
    })
  }),
)

// @desc    Delete finance record
// @route   DELETE /api/finance/:id
// @access  Private
router.delete(
  "/:id",
  checkPermission("finance", "delete"),
  asyncHandler(async (req, res) => {
    const record = await Finance.findOne({
      _id: req.params.id,
      venueId: req.user.venueId,
    })

    if (!record) {
      return res.status(404).json({ message: "Finance record not found" })
    }

    await Finance.findByIdAndDelete(record._id)

    res.json({ message: "Finance record deleted successfully" })
  }),
)

// @desc    Get financial statistics
// @route   GET /api/finance/stats/overview
// @access  Private
router.get(
  "/stats/overview",
  checkPermission("finance", "view"),
  asyncHandler(async (req, res) => {
    const venueId = req.user.venueId

    const stats = await Finance.aggregate([
      { $match: { venueId } },
      {
        $group: {
          _id: "$type",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ])

    const categoryBreakdown = await Finance.aggregate([
      { $match: { venueId } },
      {
        $group: {
          _id: { type: "$type", category: "$category" },
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ])

    const monthlyTrends = await Finance.aggregate([
      { $match: { venueId } },
      {
        $group: {
          _id: {
            year: { $year: "$date" },
            month: { $month: "$date" },
            type: "$type",
          },
          total: { $sum: "$amount" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
      { $limit: 24 },
    ])

    // Calculate totals
    const income = stats.find((s) => s._id === "income")?.total || 0
    const expenses = stats.find((s) => s._id === "expense")?.total || 0
    const netProfit = income - expenses

    res.json({
      overview: {
        totalIncome: income,
        totalExpenses: expenses,
        netProfit,
        profitMargin: income > 0 ? ((netProfit / income) * 100).toFixed(2) : 0,
      },
      categoryBreakdown,
      monthlyTrends,
    })
  }),
)

export default router
