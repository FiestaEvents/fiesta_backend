import asyncHandler from "../middleware/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { Partner, Event } from "../models/index.js";

/**
 * @desc    Get all partners
 * @route   GET /api/v1/partners
 * @access  Private
 */
export const getPartners = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    category,
    status,
    search,
    sortBy = "createdAt",
    order = "desc",
  } = req.query;

  // Build query
  const query = { venueId: req.user.venueId };

  if (category) query.category = category;
  if (status) query.status = status;

  // Search by name or company
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { company: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  // Pagination
  const skip = (page - 1) * limit;

  // Sort
  const sortOrder = order === "asc" ? 1 : -1;
  const sortOptions = { [sortBy]: sortOrder };

  // Execute query
  const [partners, total] = await Promise.all([
    Partner.find(query)
      .populate("createdBy", "name email")
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit)),
    Partner.countDocuments(query),
  ]);

  new ApiResponse({
    partners,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit),
    },
  }).send(res);
});

/**
 * @desc    Get single partner
 * @route   GET /api/v1/partners/:id
 * @access  Private
 */
export const getPartner = asyncHandler(async (req, res) => {
  const partner = await Partner.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  }).populate("createdBy", "name email");

  if (!partner) {
    throw new ApiError("Partner not found", 404);
  }

  // Get events where this partner is involved
  const events = await Event.find({
    venueId: req.user.venueId,
    "partners.partner": partner._id,
  })
    .select("title startDate status partners.$")
    .sort({ startDate: -1 })
    .limit(10);

  new ApiResponse({
    partner: {
      ...partner.toObject(),
      recentEvents: events,
    },
  }).send(res);
});

/**
 * @desc    Create new partner
 * @route   POST /api/v1/partners
 * @access  Private (partners.create)
 */
export const createPartner = asyncHandler(async (req, res) => {
  // Check if partner with email already exists in this venue
  const existingPartner = await Partner.findOne({
    email: req.body.email,
    venueId: req.user.venueId,
  });

  if (existingPartner) {
    throw new ApiError("Partner with this email already exists", 400);
  }

  const partner = await Partner.create({
    ...req.body,
    venueId: req.user.venueId,
    createdBy: req.user._id,
  });

  new ApiResponse({ partner }, "Partner created successfully", 201).send(res);
});

/**
 * @desc    Update partner
 * @route   PUT /api/v1/partners/:id
 * @access  Private (partners.update.all)
 */
export const updatePartner = asyncHandler(async (req, res) => {
  const partner = await Partner.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  });

  if (!partner) {
    throw new ApiError("Partner not found", 404);
  }

  // Check if email is being changed and if it's already in use
  if (req.body.email && req.body.email !== partner.email) {
    const existingPartner = await Partner.findOne({
      email: req.body.email,
      venueId: req.user.venueId,
      _id: { $ne: partner._id },
    });

    if (existingPartner) {
      throw new ApiError("Partner with this email already exists", 400);
    }
  }

  Object.assign(partner, req.body);
  await partner.save();

  new ApiResponse({ partner }, "Partner updated successfully").send(res);
});

/**
 * @desc    Delete partner
 * @route   DELETE /api/v1/partners/:id
 * @access  Private (partners.delete.all)
 */
export const deletePartner = asyncHandler(async (req, res) => {
  const partner = await Partner.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  });

  if (!partner) {
    throw new ApiError("Partner not found", 404);
  }

  // Check if partner is associated with any events
  const eventsWithPartner = await Event.countDocuments({
    venueId: req.user.venueId,
    "partners.partner": partner._id,
  });

  if (eventsWithPartner > 0) {
    throw new ApiError(
      `Cannot delete partner associated with ${eventsWithPartner} event(s)`,
      400
    );
  }

  await partner.deleteOne();

  new ApiResponse(null, "Partner deleted successfully").send(res);
});

/**
 * @desc    Get partner statistics
 * @route   GET /api/v1/partners/stats
 * @access  Private
 */
export const getPartnerStats = asyncHandler(async (req, res) => {
  const venueId = req.user.venueId;

  const [totalPartners, activePartners, partnersByCategory] = await Promise.all([
    Partner.countDocuments({ venueId }),
    Partner.countDocuments({ venueId, status: "active" }),
    Partner.aggregate([
      { $match: { venueId } },
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]),
  ]);

  new ApiResponse({
    totalPartners,
    activePartners,
    partnersByCategory,
  }).send(res);
});