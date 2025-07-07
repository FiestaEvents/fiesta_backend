import express from "express"
import jwt from "jsonwebtoken"
import User from "../models/User.js"
import Venue from "../models/Venue.js"
import { asyncHandler } from "../middleware/errorHandler.js"
import { authMiddleware } from "../middleware/auth.js"

const router = express.Router()

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  })
}

// @desc    Register user and venue
// @route   POST /api/auth/register
// @access  Public
router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const {
      // User data
      name,
      email,
      password,
      phone,
      // Venue data
      venueName,
      venueDescription,
      venueAddress,
      venueContact,
      venueCapacity,
      venuePricing,
      subscriptionPlan,
    } = req.body

    // Check if user already exists
    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(400).json({ message: "User already exists with this email" })
    }

    // Create venue first
    const venue = new Venue({
      name: venueName,
      description: venueDescription,
      address: venueAddress,
      contact: venueContact,
      capacity: venueCapacity,
      pricing: venuePricing,
      subscription: {
        plan: subscriptionPlan,
        startDate: new Date(),
        endDate:
          subscriptionPlan === "lifetime"
            ? null
            : subscriptionPlan === "annual"
              ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
              : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        amount: subscriptionPlan === "monthly" ? 99 : subscriptionPlan === "annual" ? 990 : 3960,
      },
      owner: null, // Will be set after user creation
    })

    // Create user
    const user = new User({
      name,
      email,
      password,
      phone,
      role: "owner",
      venueId: venue._id,
    })

    // Set venue owner
    venue.owner = user._id

    // Save both
    await venue.save()
    await user.save()

    // Generate token
    const token = generateToken(user._id)

    res.status(201).json({
      message: "Registration successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        venueId: user.venueId,
      },
      venue: {
        id: venue._id,
        name: venue.name,
        subscription: venue.subscription,
      },
    })
  }),
)

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" })
    }

    // Find user and include password for comparison
    const user = await User.findOne({ email }).select("+password").populate("venueId")

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: "Invalid email or password" })
    }

    if (!user.isActive) {
      return res.status(401).json({ message: "Account is deactivated" })
    }

    // Update last login
    user.lastLogin = new Date()
    await user.save()

    // Generate token
    const token = generateToken(user._id)

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        avatar: user.avatar,
        lastLogin: user.lastLogin,
        venueId: user.venueId,
      },
    })
  }),
)

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
router.get(
  "/me",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).populate("venueId")

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        avatar: user.avatar,
        lastLogin: user.lastLogin,
        venueId: user.venueId,
      },
    })
  }),
)

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
router.put(
  "/profile",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { name, phone, avatar } = req.body

    const user = await User.findById(req.user._id)

    if (name) user.name = name
    if (phone) user.phone = phone
    if (avatar) user.avatar = avatar

    await user.save()

    res.json({
      message: "Profile updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        avatar: user.avatar,
      },
    })
  }),
)

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
router.put(
  "/change-password",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current password and new password are required" })
    }

    const user = await User.findById(req.user._id).select("+password")

    if (!(await user.comparePassword(currentPassword))) {
      return res.status(400).json({ message: "Current password is incorrect" })
    }

    user.password = newPassword
    await user.save()

    res.json({ message: "Password changed successfully" })
  }),
)

// @desc    Logout user (client-side token removal)
// @route   POST /api/auth/logout
// @access  Private
router.post(
  "/logout",
  authMiddleware,
  asyncHandler(async (req, res) => {
    res.json({ message: "Logout successful" })
  }),
)

export default router
