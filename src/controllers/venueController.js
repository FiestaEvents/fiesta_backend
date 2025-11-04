import asyncHandler from "../middleware/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { Venue } from "../models/index.js";

/**
 * @desc    Get venue details
 * @route   GET /api/v1/venues/me
 * @access  Private
 */
export const getVenue = asyncHandler(async (req, res) => {
  const venue = await Venue.findById(req.user.venueId).populate(
    "owner",
    "name email"
  );

  if (!venue) {
    throw new ApiError("Venue not found", 404);
  }

  new ApiResponse({ venue }).send(res);
});

/**
 * @desc    Update venue details
 * @route   PUT /api/v1/venues/me
 * @access  Private (venue.update)
 */
export const updateVenue = asyncHandler(async (req, res) => {
  const venue = await Venue.findById(req.user.venueId);

  if (!venue) {
    throw new ApiError("Venue not found", 404);
  }

  // Fields that can be updated
  const allowedUpdates = [
    "name",
    "description",
    "address",
    "contact",
    "capacity",
    "pricing",
    "amenities",
    "images",
    "operatingHours",
    "timeZone",
  ];

  allowedUpdates.forEach((field) => {
    if (req.body[field] !== undefined) {
      venue[field] = req.body[field];
    }
  });

  await venue.save();

  new ApiResponse({ venue }, "Venue updated successfully").send(res);
});

/**
 * @desc    Update venue subscription
 * @route   PUT /api/v1/venues/subscription
 * @access  Private (venue.manage)
 */
export const updateSubscription = asyncHandler(async (req, res) => {
  const { plan, status, endDate, amount } = req.body;

  const venue = await Venue.findById(req.user.venueId);

  if (!venue) {
    throw new ApiError("Venue not found", 404);
  }

  // Only owner can update subscription
  if (req.user.roleType !== "owner") {
    throw new ApiError("Only venue owner can update subscription", 403);
  }

  if (plan) venue.subscription.plan = plan;
  if (status) venue.subscription.status = status;
  if (endDate) venue.subscription.endDate = endDate;
  if (amount !== undefined) venue.subscription.amount = amount;

  await venue.save();

  new ApiResponse({ venue }, "Subscription updated successfully").send(res);
});

/**
 * @desc    Get venue statistics
 * @route   GET /api/v1/venues/stats
 * @access  Private
 */
export const getVenueStats = asyncHandler(async (req, res) => {
  const venueId = req.user.venueId;

  const { Event, Client, Partner, Payment, User } = await import("../models/index.js");

  const [
    totalEvents,
    upcomingEvents,
    totalClients,
    totalPartners,
    totalRevenue,
    teamSize,
  ] = await Promise.all([
    Event.countDocuments({ venueId }),
    Event.countDocuments({
      venueId,
      status: "confirmed",
      startDate: { $gte: new Date() },
    }),
    Client.countDocuments({ venueId, status: "active" }),
    Partner.countDocuments({ venueId, status: "active" }),
    Payment.aggregate([
      {
        $match: {
          venueId,
          type: "income",
          status: "completed",
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$netAmount" },
        },
      },
    ]),
    User.countDocuments({ venueId, isActive: true }),
  ]);

  new ApiResponse({
    totalEvents,
    upcomingEvents,
    totalClients,
    totalPartners,
    totalRevenue: totalRevenue[0]?.total || 0,
    teamSize,
  }).send(res);
});

/**
 * @desc    Get venue dashboard data
 * @route   GET /api/v1/venues/dashboard
 * @access  Private
 */
export const getDashboardData = asyncHandler(async (req, res) => {
  const venueId = req.user.venueId;
  const { Event, Payment, Task, Reminder } = await import("../models/index.js");

  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    upcomingEvents,
    recentPayments,
    pendingTasks,
    upcomingReminders,
    revenueThisMonth,
    eventsThisMonth,
  ] = await Promise.all([
    Event.find({
      venueId,
      startDate: { $gte: today },
      status: { $in: ["confirmed", "pending"] },
    })
      .populate("clientId", "name email")
      .sort({ startDate: 1 })
      .limit(5),

    Payment.find({
      venueId,
      type: "income",
      status: "completed",
    })
      .populate("event", "title")
      .populate("client", "name")
      .sort({ createdAt: -1 })
      .limit(5),

    Task.find({
      venueId,
      status: { $in: ["pending", "todo", "in_progress"] },
      dueDate: { $gte: today },
    })
      .populate("assignedTo", "name avatar")
      .sort({ dueDate: 1 })
      .limit(5),

    Reminder.find({
      venueId,
      status: "active",
      reminderDate: { $gte: today },
    })
      .sort({ reminderDate: 1 })
      .limit(5),

    Payment.aggregate([
      {
        $match: {
          venueId,
          type: "income",
          status: "completed",
          createdAt: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$netAmount" },
        },
      },
    ]),

    Event.countDocuments({
      venueId,
      createdAt: { $gte: thirtyDaysAgo },
    }),
  ]);

  new ApiResponse({
    upcomingEvents,
    recentPayments,
    pendingTasks,
    upcomingReminders,
    summary: {
      revenueThisMonth: revenueThisMonth[0]?.total || 0,
      eventsThisMonth,
    },
  }).send(res);
});