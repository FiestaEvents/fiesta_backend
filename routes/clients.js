import express from "express"
import Client from "../models/Client.js"
import Event from "../models/Event.js"
import { asyncHandler } from "../middleware/errorHandler.js"
import { checkPermission } from "../middleware/auth.js"

const router = express.Router()

// @desc    Get all clients
// @route   GET /api/clients
// @access  Private
router.get(
  "/",
  checkPermission("clients", "view"),
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, search, status, sortBy = "createdAt", sortOrder = "desc" } = req.query

    const query = { venueId: req.user.venueId }

    // Search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { company: { $regex: search, $options: "i" } },
      ]
    }

    // Filter by status
    if (status) {
      query.status = status
    }

    const sortOptions = {}
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1

    const clients = await Client.find(query)
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate("eventHistory.eventId", "title type startDate")

    const total = await Client.countDocuments(query)

    res.json({
      clients,
      pagination: {
        current: Number.parseInt(page),
        pages: Math.ceil(total / limit),
        total,
        limit: Number.parseInt(limit),
      },
    })
  }),
)

// @desc    Get single client
// @route   GET /api/clients/:id
// @access  Private
router.get(
  "/:id",
  checkPermission("clients", "view"),
  asyncHandler(async (req, res) => {
    const client = await Client.findOne({
      _id: req.params.id,
      venueId: req.user.venueId,
    }).populate("eventHistory.eventId")

    if (!client) {
      return res.status(404).json({ message: "Client not found" })
    }

    // Get client's events
    const events = await Event.find({
      client: client._id,
      venueId: req.user.venueId,
    }).sort({ startDate: -1 })

    res.json({ client, events })
  }),
)

// @desc    Create new client
// @route   POST /api/clients
// @access  Private
router.post(
  "/",
  checkPermission("clients", "create"),
  asyncHandler(async (req, res) => {
    const clientData = {
      ...req.body,
      venueId: req.user.venueId,
      createdBy: req.user._id,
    }

    const client = new Client(clientData)
    await client.save()

    res.status(201).json({
      message: "Client created successfully",
      client,
    })
  }),
)

// @desc    Update client
// @route   PUT /api/clients/:id
// @access  Private
router.put(
  "/:id",
  checkPermission("clients", "edit"),
  asyncHandler(async (req, res) => {
    const client = await Client.findOne({
      _id: req.params.id,
      venueId: req.user.venueId,
    })

    if (!client) {
      return res.status(404).json({ message: "Client not found" })
    }

    Object.assign(client, req.body)
    await client.save()

    res.json({
      message: "Client updated successfully",
      client,
    })
  }),
)

// @desc    Delete client
// @route   DELETE /api/clients/:id
// @access  Private
router.delete(
  "/:id",
  checkPermission("clients", "delete"),
  asyncHandler(async (req, res) => {
    const client = await Client.findOne({
      _id: req.params.id,
      venueId: req.user.venueId,
    })

    if (!client) {
      return res.status(404).json({ message: "Client not found" })
    }

    // Check if client has active events
    const activeEvents = await Event.countDocuments({
      client: client._id,
      status: { $in: ["pending", "confirmed", "in-progress"] },
    })

    if (activeEvents > 0) {
      return res.status(400).json({
        message: "Cannot delete client with active events",
        activeEvents,
      })
    }

    await Client.findByIdAndDelete(client._id)

    res.json({ message: "Client deleted successfully" })
  }),
)

// @desc    Get client statistics
// @route   GET /api/clients/stats
// @access  Private
router.get(
  "/stats/overview",
  checkPermission("clients", "view"),
  asyncHandler(async (req, res) => {
    const venueId = req.user.venueId

    const stats = await Client.aggregate([
      { $match: { venueId } },
      {
        $group: {
          _id: null,
          totalClients: { $sum: 1 },
          activeClients: { $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] } },
          vipClients: { $sum: { $cond: [{ $eq: ["$status", "vip"] }, 1, 0] } },
          totalSpent: { $sum: "$totalSpent" },
          averageSpent: { $avg: "$totalSpent" },
        },
      },
    ])

    const clientsByMonth = await Client.aggregate([
      { $match: { venueId } },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
      { $limit: 12 },
    ])

    res.json({
      overview: stats[0] || {
        totalClients: 0,
        activeClients: 0,
        vipClients: 0,
        totalSpent: 0,
        averageSpent: 0,
      },
      clientsByMonth,
    })
  }),
)

export default router
