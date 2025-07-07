import express from "express"
import Payment from "../models/Payment.js"
import Event from "../models/Event.js"
import { asyncHandler } from "../middleware/errorHandler.js"
import { checkPermission } from "../middleware/auth.js"

const router = express.Router()

// @desc    Get all payments
// @route   GET /api/payments
// @access  Private
router.get(
  "/",
  checkPermission("payments", "view"),
  asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      method,
      startDate,
      endDate,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query

    const query = { venueId: req.user.venueId }

    // Filter by status
    if (status) {
      query.status = status
    }

    // Filter by payment method
    if (method) {
      query.method = method
    }

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {}
      if (startDate) query.createdAt.$gte = new Date(startDate)
      if (endDate) query.createdAt.$lte = new Date(endDate)
    }

    const sortOptions = {}
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1

    const payments = await Payment.find(query)
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate("event", "title type startDate")
      .populate("client", "name email company")
      .populate("processedBy", "name")

    const total = await Payment.countDocuments(query)

    res.json({
      payments,
      pagination: {
        current: Number.parseInt(page),
        pages: Math.ceil(total / limit),
        total,
        limit: Number.parseInt(limit),
      },
    })
  }),
)

// @desc    Get single payment
// @route   GET /api/payments/:id
// @access  Private
router.get(
  "/:id",
  checkPermission("payments", "view"),
  asyncHandler(async (req, res) => {
    const payment = await Payment.findOne({
      _id: req.params.id,
      venueId: req.user.venueId,
    })
      .populate("event")
      .populate("client")
      .populate("processedBy", "name email")

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" })
    }

    res.json({ payment })
  }),
)

// @desc    Create new payment
// @route   POST /api/payments
// @access  Private
router.post(
  "/",
  checkPermission("payments", "create"),
  asyncHandler(async (req, res) => {
    const paymentData = {
      ...req.body,
      venueId: req.user.venueId,
      processedBy: req.user._id,
    }

    const payment = new Payment(paymentData)
    await payment.save()

    // Update event payment status
    if (payment.event) {
      const event = await Event.findById(payment.event)
      if (event) {
        event.payment.paidAmount += payment.amount
        event.payment.transactions.push({
          amount: payment.amount,
          method: payment.method,
          date: payment.paidDate || new Date(),
          reference: payment.reference,
        })

        // Update payment status based on amount paid
        const totalAmount = event.pricing.totalAmount
        const paidAmount = event.payment.paidAmount

        if (paidAmount >= totalAmount) {
          event.payment.status = "paid"
        } else if (paidAmount > 0) {
          event.payment.status = "partial"
        }

        await event.save()
      }
    }

    await payment.populate("event", "title")
    await payment.populate("client", "name")

    res.status(201).json({
      message: "Payment created successfully",
      payment,
    })
  }),
)

// @desc    Update payment
// @route   PUT /api/payments/:id
// @access  Private
router.put(
  "/:id",
  checkPermission("payments", "edit"),
  asyncHandler(async (req, res) => {
    const payment = await Payment.findOne({
      _id: req.params.id,
      venueId: req.user.venueId,
    })

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" })
    }

    const oldAmount = payment.amount
    Object.assign(payment, req.body)
    await payment.save()

    // Update event payment if amount changed
    if (payment.event && oldAmount !== payment.amount) {
      const event = await Event.findById(payment.event)
      if (event) {
        const difference = payment.amount - oldAmount
        event.payment.paidAmount += difference
        await event.save()
      }
    }

    res.json({
      message: "Payment updated successfully",
      payment,
    })
  }),
)

// @desc    Process refund
// @route   POST /api/payments/:id/refund
// @access  Private
router.post(
  "/:id/refund",
  checkPermission("payments", "edit"),
  asyncHandler(async (req, res) => {
    const { refundAmount, refundReason } = req.body

    const payment = await Payment.findOne({
      _id: req.params.id,
      venueId: req.user.venueId,
    })

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" })
    }

    if (payment.status !== "completed") {
      return res.status(400).json({ message: "Can only refund completed payments" })
    }

    if (refundAmount > payment.amount) {
      return res.status(400).json({ message: "Refund amount cannot exceed payment amount" })
    }

    payment.refundAmount = refundAmount
    payment.refundDate = new Date()
    payment.refundReason = refundReason
    payment.status = "refunded"

    await payment.save()

    // Update event payment
    if (payment.event) {
      const event = await Event.findById(payment.event)
      if (event) {
        event.payment.paidAmount -= refundAmount
        await event.save()
      }
    }

    res.json({
      message: "Refund processed successfully",
      payment,
    })
  }),
)

// @desc    Get payment statistics
// @route   GET /api/payments/stats/overview
// @access  Private
router.get(
  "/stats/overview",
  checkPermission("payments", "view"),
  asyncHandler(async (req, res) => {
    const venueId = req.user.venueId

    const stats = await Payment.aggregate([
      { $match: { venueId } },
      {
        $group: {
          _id: null,
          totalPayments: { $sum: 1 },
          completedPayments: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
          pendingPayments: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
          totalAmount: { $sum: "$amount" },
          totalRefunds: { $sum: "$refundAmount" },
          netAmount: { $sum: "$netAmount" },
        },
      },
    ])

    const paymentsByMethod = await Payment.aggregate([
      { $match: { venueId } },
      {
        $group: {
          _id: "$method",
          count: { $sum: 1 },
          amount: { $sum: "$amount" },
        },
      },
      { $sort: { amount: -1 } },
    ])

    const paymentsByMonth = await Payment.aggregate([
      { $match: { venueId } },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          count: { $sum: 1 },
          amount: { $sum: "$amount" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
      { $limit: 12 },
    ])

    res.json({
      overview: stats[0] || {
        totalPayments: 0,
        completedPayments: 0,
        pendingPayments: 0,
        totalAmount: 0,
        totalRefunds: 0,
        netAmount: 0,
      },
      paymentsByMethod,
      paymentsByMonth,
    })
  }),
)

export default router
