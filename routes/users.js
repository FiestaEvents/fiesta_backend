import express from "express"
import User from "../models/User.js"
import { asyncHandler } from "../middleware/errorHandler.js"
import { authorize } from "../middleware/auth.js"

const router = express.Router()

// @desc    Get all users (venue staff)
// @route   GET /api/users
// @access  Private (Owner/Manager only)
router.get(
  "/",
  authorize("owner", "manager"),
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, search, role, isActive, sortBy = "createdAt", sortOrder = "desc" } = req.query

    const query = { venueId: req.user.venueId }

    // Search functionality
    if (search) {
      query.$or = [{ name: { $regex: search, $options: "i" } }, { email: { $regex: search, $options: "i" } }]
    }

    // Filter by role
    if (role) {
      query.role = role
    }

    // Filter by active status
    if (isActive !== undefined) {
      query.isActive = isActive === "true"
    }

    const sortOptions = {}
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1

    const users = await User.find(query)
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select("-password")

    const total = await User.countDocuments(query)

    res.json({
      users,
      pagination: {
        current: Number.parseInt(page),
        pages: Math.ceil(total / limit),
        total,
        limit: Number.parseInt(limit),
      },
    })
  }),
)

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private (Owner/Manager only)
router.get(
  "/:id",
  authorize("owner", "manager"),
  asyncHandler(async (req, res) => {
    const user = await User.findOne({
      _id: req.params.id,
      venueId: req.user.venueId,
    }).select("-password")

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    res.json({ user })
  }),
)

// @desc    Create new user
// @route   POST /api/users
// @access  Private (Owner only)
router.post(
  "/",
  authorize("owner"),
  asyncHandler(async (req, res) => {
    const userData = {
      ...req.body,
      venueId: req.user.venueId,
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: userData.email })
    if (existingUser) {
      return res.status(400).json({ message: "User already exists with this email" })
    }

    const user = new User(userData)
    await user.save()

    res.status(201).json({
      message: "User created successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        isActive: user.isActive,
      },
    })
  }),
)

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private (Owner only)
router.put(
  "/:id",
  authorize("owner"),
  asyncHandler(async (req, res) => {
    const user = await User.findOne({
      _id: req.params.id,
      venueId: req.user.venueId,
    })

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    // Don't allow updating password through this route
    delete req.body.password

    Object.assign(user, req.body)
    await user.save()

    res.json({
      message: "User updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        isActive: user.isActive,
      },
    })
  }),
)

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private (Owner only)
router.delete(
  "/:id",
  authorize("owner"),
  asyncHandler(async (req, res) => {
    const user = await User.findOne({
      _id: req.params.id,
      venueId: req.user.venueId,
    })

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    // Don't allow deleting the venue owner
    if (user.role === "owner") {
      return res.status(400).json({ message: "Cannot delete venue owner" })
    }

    // Soft delete - deactivate user
    user.isActive = false
    await user.save()

    res.json({ message: "User deactivated successfully" })
  }),
)

// @desc    Reset user password
// @route   POST /api/users/:id/reset-password
// @access  Private (Owner only)
router.post(
  "/:id/reset-password",
  authorize("owner"),
  asyncHandler(async (req, res) => {
    const { newPassword } = req.body

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long" })
    }

    const user = await User.findOne({
      _id: req.params.id,
      venueId: req.user.venueId,
    })

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    user.password = newPassword
    await user.save()

    res.json({ message: "Password reset successfully" })
  }),
)

// @desc    Get user statistics
// @route   GET /api/users/stats/overview
// @access  Private (Owner/Manager only)
router.get(
  "/stats/overview",
  authorize("owner", "manager"),
  asyncHandler(async (req, res) => {
    const venueId = req.user.venueId

    const stats = await User.aggregate([
      { $match: { venueId } },
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          activeUsers: { $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] } },
          inactiveUsers: { $sum: { $cond: [{ $eq: ["$isActive", false] }, 1, 0] } },
        },
      },
    ])

    const usersByRole = await User.aggregate([
      { $match: { venueId } },
      {
        $group: {
          _id: "$role",
          count: { $sum: 1 },
          active: { $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] } },
        },
      },
      { $sort: { count: -1 } },
    ])

    const recentUsers = await User.find({ venueId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("name email role createdAt isActive")

    res.json({
      overview: stats[0] || {
        totalUsers: 0,
        activeUsers: 0,
        inactiveUsers: 0,
      },
      usersByRole,
      recentUsers,
    })
  }),
)

export default router
