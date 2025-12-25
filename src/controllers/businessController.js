import mongoose from "mongoose";
import asyncHandler from "../middleware/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { Business } from "../models/index.js";
import Space from "../models/Space.js"; 

/**
 * Helper to safely get Business ID string
 */
const getBusinessId = (user) => {
  if (!user || !user.businessId) return null;
  return user.businessId._id ? user.businessId._id : user.businessId;
};

/**
 * @desc    Get business details (Current User's Business)
 * @route   GET /api/v1/business/me
 * @access  Private
 */
export const getBusiness = asyncHandler(async (req, res) => {
  const businessId = getBusinessId(req.user);
  
  const business = await Business.findById(businessId).populate(
    "owner",
    "name email"
  );

  if (!business) {
    throw new ApiError("Business not found", 404);
  }

  new ApiResponse({ business }).send(res);
});

/**
 * @desc    Update business details
 * @route   PUT /api/v1/business/me
 * @access  Private (business.update)
 */
export const updateBusiness = asyncHandler(async (req, res) => {
  const businessId = getBusinessId(req.user);
  const business = await Business.findById(businessId);

  if (!business) {
    throw new ApiError("Business not found", 404);
  }

  // 1. Generic Fields (Shared by all verticals)
  const genericUpdates = [
    "name",
    "description",
    "address", // Object
    "contact", // Object
    "operatingHours", // Object
    "timeZone",
    "settings", // Currency, Tax Rate
    "images"
  ];

  genericUpdates.forEach((field) => {
    if (req.body[field] !== undefined) {
      business[field] = req.body[field];
    }
  });

  // 2. Vertical-Specific Updates (Polymorphic)
  // Logic: Only allow updating details relevant to the specific category
  if (business.category === 'venue' && req.body.venueDetails) {
     // Merge venue details (capacity, spaces meta)
     business.venueDetails = { ...business.venueDetails, ...req.body.venueDetails };
  } else if (business.category !== 'venue' && req.body.serviceDetails) {
     // Merge service details (radius, pricing model, portfolio)
     business.serviceDetails = { ...business.serviceDetails, ...req.body.serviceDetails };
  }

  await business.save();

  new ApiResponse({ business }, "Business profile updated successfully").send(res);
});

/**
 * @desc    Update business subscription
 * @route   PUT /api/v1/business/subscription
 * @access  Private (business.manage)
 */
export const updateSubscription = asyncHandler(async (req, res) => {
  const { plan, status, endDate, amount } = req.body;
  const businessId = getBusinessId(req.user);

  const business = await Business.findById(businessId);

  if (!business) {
    throw new ApiError("Business not found", 404);
  }

  if (req.user.roleType !== "owner") {
    throw new ApiError("Only business owner can update subscription", 403);
  }

  if (plan) business.subscription.plan = plan;
  if (status) business.subscription.status = status;
  if (endDate) business.subscription.endDate = endDate;
  if (amount !== undefined) business.subscription.amount = amount;

  await business.save();

  new ApiResponse({ business }, "Subscription updated successfully").send(res);
});

/**
 * @desc    Get business statistics
 * @route   GET /api/v1/business/stats
 * @access  Private
 */
export const getBusinessStats = asyncHandler(async (req, res) => {
  const businessId = getBusinessId(req.user);

  const { Event, Client, Partner, Payment, User } = await import(
    "../models/index.js"
  );

  const [
    totalEvents,
    upcomingEvents,
    totalClients,
    totalPartners,
    totalRevenue,
    teamSize,
  ] = await Promise.all([
    Event.countDocuments({ businessId }),
    Event.countDocuments({
      businessId,
      status: "confirmed",
      startDate: { $gte: new Date() },
    }),
    Client.countDocuments({ businessId, status: "active" }),
    Partner.countDocuments({ businessId, status: "active" }),
    Payment.aggregate([
      {
        $match: {
          businessId: new mongoose.Types.ObjectId(businessId),
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
    User.countDocuments({ businessId, isActive: true }),
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
 * @desc    Get Chameleon Dashboard Data
 * @route   GET /api/v1/business/dashboard
 * @access  Private
 */
export const getDashboardData = asyncHandler(async (req, res) => {
  const businessId = getBusinessId(req.user);
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
      businessId,
      startDate: { $gte: today },
      status: { $in: ["confirmed", "pending"] },
    })
      .populate("clientId", "name email")
      .sort({ startDate: 1 })
      .limit(5),

    Payment.find({
      businessId,
      type: "income",
      status: "completed",
    })
      .populate("event", "title")
      .populate("client", "name")
      .sort({ createdAt: -1 })
      .limit(5),

    Task.find({
      businessId,
      status: { $in: ["pending", "todo", "in_progress"] },
      dueDate: { $gte: today },
    })
      .populate("assignedTo", "name avatar")
      .sort({ dueDate: 1 })
      .limit(5),

    Reminder.find({
      businessId,
      status: "active",
      reminderDate: { $gte: today },
    })
      .sort({ reminderDate: 1 })
      .limit(5),

    Payment.aggregate([
      {
        $match: {
          businessId: new mongoose.Types.ObjectId(businessId),
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
      businessId,
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

// ==========================================
// SPACE MANAGEMENT (For Venues)
// ==========================================

/**
 * @desc    Get paginated spaces
 * @route   GET /api/v1/business/spaces
 * @access  Private (business.read)
 */
export const getSpaces = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search,
    isActive,
    isReserved,
    includeArchived = "false",
    sortBy = "createdAt",
    order = "desc",
  } = req.query;

  const businessId = getBusinessId(req.user);
  const numericPage = Math.max(parseInt(page, 10) || 1, 1);
  const numericLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);

  // Note: Space schema refers to businessId (formerly venueId)
  const baseQuery = {
    venueId: businessId, 
  };

  if (includeArchived !== "true") {
    baseQuery.isArchived = false;
  }

  const query = { ...baseQuery };

  if (typeof isActive === "string") {
    query.isActive = isActive === "true";
  }

  if (typeof isReserved === "string") {
    query.isReserved = isReserved === "true";
  }

  if (search) {
    const searchRegex = { $regex: search, $options: "i" };
    query.$or = [
      { name: searchRegex },
      { description: searchRegex },
      { amenities: searchRegex },
    ];
  }

  const skip = (numericPage - 1) * numericLimit;
  const sortDirection = order === "asc" ? 1 : -1;
  const sortOptions = { [sortBy]: sortDirection };

  const [spaces, total, activeCount, reservedCount] = await Promise.all([
    Space.find(query).sort(sortOptions).skip(skip).limit(numericLimit),
    Space.countDocuments(query),
    Space.countDocuments({ ...baseQuery, isActive: true }),
    Space.countDocuments({ ...baseQuery, isReserved: true }),
  ]);

  new ApiResponse({
    spaces,
    pagination: {
      page: numericPage,
      limit: numericLimit,
      total,
      pages: Math.ceil(total / numericLimit) || 1,
    },
    summary: {
      totalSpaces: total,
      totalActive: activeCount,
      totalReserved: reservedCount,
    },
  }).send(res);
});

/**
 * @desc    Create a new space
 * @route   POST /api/v1/business/spaces
 * @access  Private (business.create)
 */
export const createSpace = asyncHandler(async (req, res) => {
  const { name, capacity, description } = req.body;
  const businessId = getBusinessId(req.user);

  // Optional: Ensure only Venues create spaces
  // const business = await Business.findById(businessId);
  // if (business.category !== 'venue') throw new ApiError("Only venues can create spaces", 400);

  if (!name || !description) {
    throw new ApiError("Name and description are required", 400);
  }

  if (!capacity || capacity.min === undefined || capacity.max === undefined) {
    throw new ApiError("Capacity with min and max values is required", 400);
  }

  if (capacity.min > capacity.max) {
    throw new ApiError("Capacity minimum cannot be greater than maximum", 400);
  }

  const existingSpace = await Space.findOne({
    venueId: businessId,
    name: name.trim(),
  });

  if (existingSpace) {
    throw new ApiError("A space with this name already exists", 400);
  }

  const space = await Space.create({
    ...req.body,
    name: name.trim(),
    venueId: businessId,
    owner: req.user._id,
  });

  new ApiResponse(
    { space },
    "Space created successfully",
    201
  ).send(res);
});

/**
 * @desc    Get single space
 * @route   GET /api/v1/business/spaces/:spaceId
 * @access  Private (business.read)
 */
export const getSpace = asyncHandler(async (req, res) => {
  const { spaceId } = req.params;
  const businessId = getBusinessId(req.user);

  if (!mongoose.isValidObjectId(spaceId)) {
    throw new ApiError("Invalid space id", 400);
  }

  const space = await Space.findOne({
    _id: spaceId,
    venueId: businessId,
  });

  if (!space) {
    throw new ApiError("Space not found", 404);
  }

  new ApiResponse({ space }).send(res);
});

/**
 * @desc    Update space
 * @route   PUT /api/v1/business/spaces/:spaceId
 * @access  Private (business.update)
 */
export const updateSpace = asyncHandler(async (req, res) => {
  const { spaceId } = req.params;
  const businessId = getBusinessId(req.user);

  if (!mongoose.isValidObjectId(spaceId)) {
    throw new ApiError("Invalid space id", 400);
  }

  const space = await Space.findOne({
    _id: spaceId,
    venueId: businessId,
  });

  if (!space) {
    throw new ApiError("Space not found", 404);
  }

  const allowedUpdates = [
    "name",
    "description",
    "capacity",
    "basePrice",
    "amenities",
    "images",
    "operatingHours",
    "isReserved",
    "isActive",
    "isArchived",
    "timeZone",
  ];

  allowedUpdates.forEach((field) => {
    if (req.body[field] !== undefined) {
      space[field] = req.body[field];
    }
  });

  if (req.body.capacity) {
    const { min, max } = req.body.capacity;
    if (
      min === undefined ||
      max === undefined ||
      Number.isNaN(Number(min)) ||
      Number.isNaN(Number(max))
    ) {
      throw new ApiError("Capacity must include valid min and max values", 400);
    }

    if (min > max) {
      throw new ApiError(
        "Capacity minimum cannot be greater than maximum",
        400
      );
    }

    space.capacity = {
      min,
      max,
    };
  }

  if (req.body.name) {
    space.name = req.body.name.trim();
  }

  await space.save();

  new ApiResponse(
    { space },
    "Space updated successfully"
  ).send(res);
});

/**
 * @desc    Delete space
 * @route   DELETE /api/v1/business/spaces/:spaceId
 * @access  Private (business.delete)
 */
export const deleteSpace = asyncHandler(async (req, res) => {
  const { spaceId } = req.params;
  const businessId = getBusinessId(req.user);

  if (!mongoose.isValidObjectId(spaceId)) {
    throw new ApiError("Invalid space id", 400);
  }

  const space = await Space.findOne({
    _id: spaceId,
    venueId: businessId,
  });

  if (!space) {
    throw new ApiError("Space not found", 404);
  }

  await space.deleteOne();

  new ApiResponse({ spaceId }, "Space deleted successfully").send(res);
});