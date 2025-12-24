import mongoose from "mongoose";
import asyncHandler from "../middleware/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { Venue } from "../models/index.js";
import VenueSpace from "../models/VenueSpace.js";

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

/**
 * @desc    Get paginated venue spaces
 * @route   GET /api/v1/venues/spaces
 * @access  Private (venue.read)
 */
export const getVenueSpaces = asyncHandler(async (req, res) => {
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

  const numericPage = Math.max(parseInt(page, 10) || 1, 1);
  const numericLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);

  const baseQuery = {
    venueId: req.user.venueId,
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
    VenueSpace.find(query).sort(sortOptions).skip(skip).limit(numericLimit),
    VenueSpace.countDocuments(query),
    VenueSpace.countDocuments({ ...baseQuery, isActive: true }),
    VenueSpace.countDocuments({ ...baseQuery, isReserved: true }),
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
 * @desc    Create a new venue space
 * @route   POST /api/v1/venues/spaces
 * @access  Private (venue.create)
 */
export const createVenueSpace = asyncHandler(async (req, res) => {
  const { name, capacity, description } = req.body;

  if (!name || !description) {
    throw new ApiError("Name and description are required", 400);
  }

  if (!capacity || capacity.min === undefined || capacity.max === undefined) {
    throw new ApiError("Capacity with min and max values is required", 400);
  }

  if (capacity.min > capacity.max) {
    throw new ApiError("Capacity minimum cannot be greater than maximum", 400);
  }

  const existingSpace = await VenueSpace.findOne({
    venueId: req.user.venueId,
    name: name.trim(),
  });

  if (existingSpace) {
    throw new ApiError("A venue space with this name already exists", 400);
  }

  const venueSpace = await VenueSpace.create({
    ...req.body,
    name: name.trim(),
    venueId: req.user.venueId,
    owner: req.user._id,
  });

  new ApiResponse(
    { space: venueSpace },
    "Venue space created successfully",
    201
  ).send(res);
});

/**
 * @desc    Get single venue space
 * @route   GET /api/v1/venues/spaces/:spaceId
 * @access  Private (venue.read)
 */
export const getVenueSpace = asyncHandler(async (req, res) => {
  const { spaceId } = req.params;

  if (!mongoose.isValidObjectId(spaceId)) {
    throw new ApiError("Invalid venue space id", 400);
  }

  const venueSpace = await VenueSpace.findOne({
    _id: spaceId,
    venueId: req.user.venueId,
  });

  if (!venueSpace) {
    throw new ApiError("Venue space not found", 404);
  }

  new ApiResponse({ space: venueSpace }).send(res);
});

/**
 * @desc    Update venue space
 * @route   PUT /api/v1/venues/spaces/:spaceId
 * @access  Private (venue.update)
 */
export const updateVenueSpace = asyncHandler(async (req, res) => {
  const { spaceId } = req.params;

  if (!mongoose.isValidObjectId(spaceId)) {
    throw new ApiError("Invalid venue space id", 400);
  }

  const venueSpace = await VenueSpace.findOne({
    _id: spaceId,
    venueId: req.user.venueId,
  });

  if (!venueSpace) {
    throw new ApiError("Venue space not found", 404);
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
      venueSpace[field] = req.body[field];
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

    venueSpace.capacity = {
      min,
      max,
    };
  }

  if (req.body.name) {
    venueSpace.name = req.body.name.trim();
  }

  await venueSpace.save();

  new ApiResponse(
    { space: venueSpace },
    "Venue space updated successfully"
  ).send(res);
});

/**
 * @desc    Delete venue space
 * @route   DELETE /api/v1/venues/spaces/:spaceId
 * @access  Private (venue.delete)
 */
export const deleteVenueSpace = asyncHandler(async (req, res) => {
  const { spaceId } = req.params;

  if (!mongoose.isValidObjectId(spaceId)) {
    throw new ApiError("Invalid venue space id", 400);
  }

  const venueSpace = await VenueSpace.findOne({
    _id: spaceId,
    venueId: req.user.venueId,
  });

  if (!venueSpace) {
    throw new ApiError("Venue space not found", 404);
  }

  await venueSpace.deleteOne();

  new ApiResponse({ spaceId }, "Venue space deleted successfully").send(res);
});
/**
 * @desc    Upload image to portfolio
 * @route   POST /api/v1/business/portfolio
 * @access  Private (Owner/Manager)
 */
export const uploadPortfolioImage = asyncHandler(async (req, res) => {
  // Multer adds the 'file' object to req
  if (!req.file) {
    throw new ApiError("No image file provided", 400);
  }

  const { title, description } = req.body;
  const imageUrl = req.file.path; // Cloudinary returns the URL in 'path'

  // Push to Business Model
  const business = await Business.findByIdAndUpdate(
    req.user.businessId,
    {
      $push: {
        "serviceDetails.portfolio": {
          url: imageUrl,
          title: title || "Portfolio Image",
          description: description || "",
          uploadedAt: new Date()
        }
      }
    },
    { new: true }
  );

  new ApiResponse(
    { 
      portfolio: business.serviceDetails.portfolio,
      newImage: imageUrl 
    }, 
    "Image uploaded successfully"
  ).send(res);
});

/**
 * @desc    Delete image from portfolio
 * @route   DELETE /api/v1/business/portfolio/:imageId
 */
export const deletePortfolioImage = asyncHandler(async (req, res) => {
    // Logic to pull from array and delete from Cloudinary...
});