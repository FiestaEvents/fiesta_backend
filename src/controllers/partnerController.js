import asyncHandler from "../middleware/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { Partner, Event } from "../models/index.js";

/**
 * @desc    Get all partners (non-archived by default)
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
    includeArchived = false, // New parameter to include archived partners
  } = req.query;

  // Build query
  const query = { venueId: req.user.venueId };

  if (category) query.category = category;
  if (status) query.status = status;
  
  // Modified: Only fetch non-archived partners by default
  if (!includeArchived) {
    query.isArchived = false;
  }

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
      .populate("archivedBy", "name email")
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
 * @desc    Get single partner (including archived)
 * @route   GET /api/v1/partners/:id
 * @access  Private
 */
export const getPartner = asyncHandler(async (req, res) => {
  const partner = await Partner.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  })
    .populate("createdBy", "name email")
    .populate("archivedBy", "name email");

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
  // Check if partner with email already exists in this venue (non-archived)
  const existingPartner = await Partner.findOne({
    email: req.body.email,
    venueId: req.user.venueId,
    isArchived: false, // Only check non-archived partners
  });

  if (existingPartner) {
    throw new ApiError("Partner with this email already exists", 400);
  }

  const partner = await Partner.create({
    ...req.body,
    venueId: req.user.venueId,
    createdBy: req.user._id,
    isArchived: false, // Ensure new partners are not archived
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

  if (partner.isArchived) {
    throw new ApiError("Cannot update an archived partner", 400);
  }

  // Check if email is being changed and if it's already in use (non-archived)
  if (req.body.email && req.body.email !== partner.email) {
    const existingPartner = await Partner.findOne({
      email: req.body.email,
      venueId: req.user.venueId,
      _id: { $ne: partner._id },
      isArchived: false,
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
 * @desc    Archive partner (soft delete)
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

  if (partner.isArchived) {
    throw new ApiError("Partner is already archived", 400);
  }

  // Check if partner is associated with any events
  const eventsWithPartner = await Event.countDocuments({
    venueId: req.user.venueId,
    "partners.partner": partner._id,
  });

  if (eventsWithPartner > 0) {
    throw new ApiError(
      `Cannot archive partner associated with ${eventsWithPartner} event(s)`,
      400
    );
  }

  // Soft delete: Archive the partner instead of deleting
  partner.isArchived = true;
  partner.archivedAt = new Date();
  partner.archivedBy = req.user._id;
  await partner.save();

  new ApiResponse(null, "Partner archived successfully").send(res);
});

/**
 * @desc    Restore archived partner
 * @route   PATCH /api/v1/partners/:id/restore
 * @access  Private (partners.update.all)
 */
export const restorePartner = asyncHandler(async (req, res) => {
  const partner = await Partner.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  });

  if (!partner) {
    throw new ApiError("Partner not found", 404);
  }

  if (!partner.isArchived) {
    throw new ApiError("Partner is not archived", 400);
  }

  // Check if email conflicts with existing active partners
  const existingPartner = await Partner.findOne({
    email: partner.email,
    venueId: req.user.venueId,
    _id: { $ne: partner._id },
    isArchived: false,
  });

  if (existingPartner) {
    throw new ApiError(
      "Cannot restore partner: email already in use by another active partner",
      400
    );
  }

  partner.isArchived = false;
  partner.archivedAt = undefined;
  partner.archivedBy = undefined;
  await partner.save();

  new ApiResponse({ partner }, "Partner restored successfully").send(res);
});

/**
 * @desc    Get partner statistics (non-archived only)
 * @route   GET /api/v1/partners/stats
 * @access  Private
 */
export const getPartnerStats = asyncHandler(async (req, res) => {
  const venueId = req.user.venueId;

  const [totalPartners, activePartners, partnersByCategory, archivedPartners] = await Promise.all([
    Partner.countDocuments({ venueId, isArchived: false }),
    Partner.countDocuments({ venueId, status: "active", isArchived: false }),
    Partner.aggregate([
      { 
        $match: { 
          venueId,
          isArchived: false 
        } 
      },
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]),
    Partner.countDocuments({ venueId, isArchived: true }),
  ]);

  new ApiResponse({
    totalPartners,
    activePartners,
    partnersByCategory,
    archivedPartners,
  }).send(res);
});

/**
 * @desc    Get archived partners
 * @route   GET /api/v1/partners/archived
 * @access  Private
 */
export const getArchivedPartners = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    sortBy = "archivedAt",
    order = "desc",
  } = req.query;

  // Build query for archived partners only
  const query = { 
    venueId: req.user.venueId,
    isArchived: true 
  };

  // Pagination
  const skip = (page - 1) * limit;

  // Sort
  const sortOrder = order === "asc" ? 1 : -1;
  const sortOptions = { [sortBy]: sortOrder };

  // Execute query
  const [partners, total] = await Promise.all([
    Partner.find(query)
      .populate("createdBy", "name email")
      .populate("archivedBy", "name email")
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