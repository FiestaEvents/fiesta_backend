import express from "express"
import Partner from "../models/Partner.js"
import Event from "../models/Event.js"
import { asyncHandler } from "../middleware/errorHandler.js"
import { checkPermission } from "../middleware/auth.js"

const router = express.Router()

// @desc    Get all partners
// @route   GET /api/partners
// @access  Private
router.get(
  "/",
  checkPermission("partners", "view"),
  asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 10,
      search,
      category,
      availability,
      rating,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query

    const query = { venueId: req.user.venueId, isActive: true }

    // Search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { company: { $regex: search, $options: "i" } },
        { specialties: { $in: [new RegExp(search, "i")] } },
      ]
    }

    // Filter by category
    if (category) {
      query.category = category
    }

    // Filter by availability
    if (availability) {
      query.availability = availability
    }

    // Filter by rating
    if (rating) {
      query.rating = { $gte: Number.parseInt(rating) }
    }

    const sortOptions = {}
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1

    const partners = await Partner.find(query)
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate("eventHistory.eventId", "title type startDate")

    const total = await Partner.countDocuments(query)

    res.json({
      partners,
      pagination: {
        current: Number.parseInt(page),
        pages: Math.ceil(total / limit),
        total,
        limit: Number.parseInt(limit),
      },
    })
  }),
)

// @desc    Get single partner
// @route   GET /api/partners/:id
// @access  Private
router.get(
  "/:id",
  checkPermission("partners", "view"),
  asyncHandler(async (req, res) => {
    const partner = await Partner.findOne({
      _id: req.params.id,
      venueId: req.user.venueId,
    }).populate("eventHistory.eventId")

    if (!partner) {
      return res.status(404).json({ message: "Partner not found" })
    }

    // Get partner's events
    const events = await Event.find({
      "partners.partner": partner._id,
      venueId: req.user.venueId,
    }).sort({ startDate: -1 })

    res.json({ partner, events })
  }),
)

// @desc    Create new partner
// @route   POST /api/partners
// @access  Private
router.post(
  "/",
  checkPermission("partners", "create"),
  asyncHandler(async (req, res) => {
    const partnerData = {
      ...req.body,
      venueId: req.user.venueId,
      createdBy: req.user._id,
    }

    const partner = new Partner(partnerData)
    await partner.save()

    res.status(201).json({
      message: "Partner created successfully",
      partner,
    })
  }),
)

// @desc    Update partner
// @route   PUT /api/partners/:id
// @access  Private
router.put(
  "/:id",
  checkPermission("partners", "edit"),
  asyncHandler(async (req, res) => {
    const partner = await Partner.findOne({
      _id: req.params.id,
      venueId: req.user.venueId,
    })

    if (!partner) {
      return res.status(404).json({ message: "Partner not found" })
    }

    Object.assign(partner, req.body)
    await partner.save()

    res.json({
      message: "Partner updated successfully",
      partner,
    })
  }),
)

// @desc    Delete partner
// @route   DELETE /api/partners/:id
// @access  Private
router.delete(
  "/:id",
  checkPermission("partners", "delete"),
  asyncHandler(async (req, res) => {
    const partner = await Partner.findOne({
      _id: req.params.id,
      venueId: req.user.venueId,
    })

    if (!partner) {
      return res.status(404).json({ message: "Partner not found" })
    }

    // Check if partner has active events
    const activeEvents = await Event.countDocuments({
      "partners.partner": partner._id,
      status: { $in: ["pending", "confirmed", "in-progress"] },
    })

    if (activeEvents > 0) {
      return res.status(400).json({
        message: "Cannot delete partner with active events",
        activeEvents,
      })
    }

    // Soft delete - mark as inactive
    partner.isActive = false
    await partner.save()

    res.json({ message: "Partner deactivated successfully" })
  }),
)

// @desc    Get partner statistics
// @route   GET /api/partners/stats/overview
// @access  Private
router.get(
  "/stats/overview",
  checkPermission("partners", "view"),
  asyncHandler(async (req, res) => {
    const venueId = req.user.venueId

    const stats = await Partner.aggregate([
      { $match: { venueId, isActive: true } },
      {
        $group: {
          _id: null,
          totalPartners: { $sum: 1 },
          availablePartners: { $sum: { $cond: [{ $eq: ["$availability", "available"] }, 1, 0] } },
          busyPartners: { $sum: { $cond: [{ $eq: ["$availability", "busy"] }, 1, 0] } },
          totalEarnings: { $sum: "$totalEarnings" },
          averageRating: { $avg: "$rating" },
        },
      },
    ])

    const partnersByCategory = await Partner.aggregate([
      { $match: { venueId, isActive: true } },
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
          averageRating: { $avg: "$rating" },
        },
      },
      { $sort: { count: -1 } },
    ])

    const topPartners = await Partner.find({ venueId, isActive: true })
      .sort({ totalEarnings: -1, rating: -1 })
      .limit(5)
      .select("name company category rating totalEarnings")

    res.json({
      overview: stats[0] || {
        totalPartners: 0,
        availablePartners: 0,
        busyPartners: 0,
        totalEarnings: 0,
        averageRating: 0,
      },
      partnersByCategory,
      topPartners,
    })
  }),
)

export default router
