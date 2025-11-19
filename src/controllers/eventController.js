import asyncHandler from "../middleware/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { Event, Client, Partner } from "../models/index.js";

/**
 * @desc    Get all events
 * @route   GET /api/v1/events
 * @access  Private
 */
export const getEvents = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    status,
    type,
    clientId,
    startDate,
    endDate,
    search,
    includeArchived = false,
  } = req.query;

  const query = { venueId: req.user.venueId };

  if (status) query.status = status;
  if (type) query.type = type;
  if (clientId) query.clientId = clientId;

  if (startDate || endDate) {
    query.startDate = {};
    if (startDate) query.startDate.$gte = new Date(startDate);
    if (endDate) query.startDate.$lte = new Date(endDate);
  }

  if (search) {
    query.title = { $regex: search, $options: "i" };
  }

  if (includeArchived === "true" || includeArchived === true) {
    // Include all events
  } else {
    query.isArchived = { $ne: true };
  }

  const skip = (page - 1) * limit;

  const [events, total] = await Promise.all([
    Event.find(query)
      .populate("clientId", "name email phone")
      .populate("partners.partner", "name category")
      .populate("createdBy", "name email")
      .populate("archivedBy", "name email")
      .sort({ startDate: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Event.countDocuments(query),
  ]);

  new ApiResponse({
    events,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit),
    },
  }).send(res);
});

/**
 * @desc    Get events by client ID
 * @route   GET /api/v1/events/client/:clientId
 * @access  Private
 */
export const getEventsByClient = asyncHandler(async (req, res) => {
  const { clientId } = req.params;
  const {
    page = 1,
    limit = 50,
    status,
    sortBy = "startDate",
    order = "desc",
    includeArchived = false,
  } = req.query;

  const client = await Client.findOne({
    _id: clientId,
    venueId: req.user.venueId,
  });

  if (!client) {
    throw new ApiError("Client not found", 404);
  }

  const query = {
    clientId: clientId,
    venueId: req.user.venueId,
  };

  if (status) query.status = status;

  if (includeArchived === "true" || includeArchived === true) {
    // Include all events
  } else {
    query.isArchived = { $ne: true };
  }

  const skip = (page - 1) * limit;
  const sortOrder = order === "asc" ? 1 : -1;
  const sortOptions = { [sortBy]: sortOrder };

  const [events, total] = await Promise.all([
    Event.find(query)
      .populate("clientId", "name email phone")
      .populate("partners.partner", "name category")
      .populate("createdBy", "name email")
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit)),
    Event.countDocuments(query),
  ]);

  const statsQuery = { ...query, isArchived: { $ne: true } };
  const stats = await Event.aggregate([
    { $match: statsQuery },
    {
      $group: {
        _id: null,
        totalEvents: { $sum: 1 },
        totalRevenue: { $sum: "$pricing.totalAmount" },
        totalPaid: { $sum: "$paymentSummary.paidAmount" },
        upcomingEvents: {
          $sum: {
            $cond: [
              { 
                $and: [
                  { $gt: ["$startDate", new Date()] },
                  { $ne: ["$status", "cancelled"] }
                ]
              },
              1,
              0
            ]
          }
        }
      }
    }
  ]);

  const clientStats = stats[0] || {
    totalEvents: 0,
    totalRevenue: 0,
    totalPaid: 0,
    upcomingEvents: 0
  };

  new ApiResponse({
    events,
    client: {
      _id: client._id,
      name: client.name,
      email: client.email,
      phone: client.phone,
    },
    stats: {
      ...clientStats,
      pendingAmount: clientStats.totalRevenue - clientStats.totalPaid
    },
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit),
    },
  }).send(res);
});

/**
 * @desc    Get single event
 * @route   GET /api/v1/events/:id
 * @access  Private
 */
export const getEvent = asyncHandler(async (req, res) => {
  const event = await Event.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  })
    .populate("clientId")
    .populate("partners.partner")
    .populate("payments")
    .populate("createdBy", "name email")
    .populate("archivedBy", "name email");

  if (!event) {
    throw new ApiError("Event not found", 404);
  }

  new ApiResponse({ event }).send(res);
});

/**
 * @desc    Update event
 * @route   PUT /api/v1/events/:id
 * @access  Private
 */
export const updateEvent = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  // Find the event
  let event = await Event.findById(id);

  if (!event) {
    throw new ApiError("Event not found", 404);
  }

  // ✅ FIX: Extract venueId correctly whether it's populated or not
  const userVenueId = req.user.venueId._id 
    ? req.user.venueId._id.toString() 
    : req.user.venueId.toString();

  const eventVenueId = event.venueId._id 
    ? event.venueId._id.toString() 
    : event.venueId.toString();

  // Check if event belongs to user's venue
  if (eventVenueId !== userVenueId) {
    throw new ApiError("Not authorized to update this event", 403);
  }

  // ✅ FIX: Preserve venueId if not provided
  if (updateData.venueSpaceId && !updateData.venueId) {
    updateData.venueId = event.venueId._id || event.venueId;
  }

  // Verify client if being updated
  if (updateData.clientId && updateData.clientId !== event.clientId.toString()) {
    const client = await Client.findOne({
      _id: updateData.clientId,
      venueId: userVenueId,
    });

    if (!client) {
      throw new ApiError("Client not found", 404);
    }
  }

  // ✅ FIX: Fetch and enrich partner data with pricing details
  if (updateData.partners && Array.isArray(updateData.partners)) {
    const partnerIds = updateData.partners.map(p => p.partner);
    const partners = await Partner.find({ 
      _id: { $in: partnerIds },
      venueId: userVenueId 
    });
    
    updateData.partners = updateData.partners.map(eventPartner => {
      const fullPartner = partners.find(
        p => p._id.toString() === eventPartner.partner.toString()
      );
      
      if (!fullPartner) {
        console.warn(`Partner ${eventPartner.partner} not found`);
        return {
          partner: eventPartner.partner,
          service: eventPartner.service || "Unknown",
          cost: eventPartner.cost || 0,
          hours: eventPartner.hours || 0,
          status: eventPartner.status || "pending",
        };
      }

      let cost = 0;
      let hours = 0;
      
      if (fullPartner.priceType === "hourly") {
        hours = eventPartner.hours || 1;
        cost = hours * (fullPartner.hourlyRate || 0);
        
        if (eventPartner.cost && eventPartner.hours) {
          cost = eventPartner.cost;
        }
      } else {
        cost = eventPartner.cost || fullPartner.fixedRate || 0;
        hours = 0;
      }

      return {
        partner: eventPartner.partner,
        service: eventPartner.service || fullPartner.category,
        cost: cost,
        hours: hours,
        status: eventPartner.status || "pending",
      };
    });
  }

  // ✅ FIX: Recalculate pricing totals
  if (updateData.pricing) {
    let total = updateData.pricing.basePrice || 0;

    if (updateData.partners && updateData.partners.length > 0) {
      const partnerCosts = updateData.partners.reduce(
        (sum, p) => sum + (p.cost || 0),
        0
      );
      total += partnerCosts;
    }

    let discountAmount = 0;
    if (updateData.pricing.discount) {
      if (updateData.pricing.discountType === "percentage") {
        discountAmount = (total * updateData.pricing.discount) / 100;
      } else {
        discountAmount = updateData.pricing.discount;
      }
    }

    total = Math.max(0, total - discountAmount);
    updateData.pricing.totalAmount = total;

    if (!updateData.paymentSummary) {
      updateData.paymentSummary = event.paymentSummary || {};
    }
    updateData.paymentSummary.totalAmount = total;
    
    const paidAmount = updateData.paymentSummary.paidAmount || event.paymentSummary?.paidAmount || 0;
    updateData.paymentSummary.amountDue = Math.max(0, total - paidAmount);
    
    if (paidAmount >= total) {
      updateData.paymentSummary.status = "paid";
    } else if (paidAmount > 0) {
      updateData.paymentSummary.status = "partial";
    } else {
      updateData.paymentSummary.status = "pending";
    }
  }

  // Check for date conflicts if dates being updated
  if (updateData.startDate && updateData.endDate && updateData.venueSpaceId) {
    const conflictingEvent = await Event.findOne({
      _id: { $ne: id },
      venueId: userVenueId,
      venueSpaceId: updateData.venueSpaceId,
      status: { $nin: ["cancelled", "completed"] },
      isArchived: { $ne: true },
      $or: [
        {
          startDate: {
            $lte: new Date(updateData.endDate),
          },
          endDate: {
            $gte: new Date(updateData.startDate),
          },
        },
      ],
    });

    if (conflictingEvent) {
      throw new ApiError(
        "This time slot conflicts with another event",
        400
      );
    }
  }

  event = await Event.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  }).populate([
    { path: "clientId", select: "name email phone" },
    { path: "venueSpaceId", select: "name capacity basePrice" },
    { path: "partners.partner", select: "name category priceType fixedRate hourlyRate" },
    { path: "createdBy", select: "name email" }
  ]);

  new ApiResponse({ event }, "Event updated successfully").send(res);
});

/**
 * @desc    Create new event
 * @route   POST /api/v1/events
 * @access  Private (events.create)
 */
export const createEvent = asyncHandler(async (req, res) => {
  // ✅ FIX: Extract venueId correctly whether it's populated or not
  const userVenueId = req.user.venueId._id 
    ? req.user.venueId._id 
    : req.user.venueId;

  const eventData = {
    ...req.body,
    venueId: userVenueId,
    createdBy: req.user._id,
  };

  // ✅ FIX: Ensure venueId is set even if only venueSpaceId is provided
  if (eventData.venueSpaceId && !eventData.venueId) {
    eventData.venueId = userVenueId;
  }

  // Verify client exists and belongs to venue
  const client = await Client.findOne({
    _id: eventData.clientId,
    venueId: userVenueId,
  });

  if (!client) {
    throw new ApiError("Client not found", 404);
  }

  // ✅ FIX: Fetch and enrich partner data with pricing details
  if (eventData.partners && Array.isArray(eventData.partners) && eventData.partners.length > 0) {
    const partnerIds = eventData.partners.map(p => p.partner);
    const partners = await Partner.find({ 
      _id: { $in: partnerIds },
      venueId: userVenueId 
    });
    
    eventData.partners = eventData.partners.map(eventPartner => {
      const fullPartner = partners.find(
        p => p._id.toString() === eventPartner.partner.toString()
      );
      
      if (!fullPartner) {
        console.warn(`Partner ${eventPartner.partner} not found in venue partners`);
        return {
          partner: eventPartner.partner,
          service: eventPartner.service || "Unknown",
          cost: eventPartner.cost || 0,
          hours: eventPartner.hours || 0,
          status: eventPartner.status || "pending",
        };
      }

      let cost = 0;
      let hours = 0;
      
      if (fullPartner.priceType === "hourly") {
        hours = eventPartner.hours || 1;
        const hourlyRate = fullPartner.hourlyRate || 0;
        cost = hours * hourlyRate;
      } else {
        cost = eventPartner.cost || fullPartner.fixedRate || 0;
        hours = 0;
      }

      return {
        partner: eventPartner.partner,
        service: eventPartner.service || fullPartner.category,
        cost: cost,
        hours: hours,
        status: eventPartner.status || "pending",
      };
    });
  }

  // ✅ FIX: Calculate pricing totals including partner costs
  if (eventData.pricing) {
    let total = eventData.pricing.basePrice || 0;

    if (eventData.partners && eventData.partners.length > 0) {
      const partnerCosts = eventData.partners.reduce(
        (sum, p) => sum + (p.cost || 0),
        0
      );
      total += partnerCosts;
    }

    let discountAmount = 0;
    if (eventData.pricing.discount) {
      if (eventData.pricing.discountType === "percentage") {
        discountAmount = (total * eventData.pricing.discount) / 100;
      } else {
        discountAmount = eventData.pricing.discount;
      }
    }

    total = Math.max(0, total - discountAmount);
    eventData.pricing.totalAmount = total;

    if (!eventData.paymentSummary) {
      eventData.paymentSummary = {
        totalAmount: total,
        paidAmount: 0,
        status: "pending"
      };
    } else {
      eventData.paymentSummary.totalAmount = total;
    }
  }

  // Check for date conflicts
  if (eventData.startDate && eventData.endDate && eventData.venueSpaceId) {
    const conflictingEvent = await Event.findOne({
      venueId: userVenueId,
      venueSpaceId: eventData.venueSpaceId,
      status: { $nin: ["cancelled", "completed"] },
      isArchived: { $ne: true },
      $or: [
        {
          startDate: {
            $lte: new Date(eventData.endDate),
          },
          endDate: {
            $gte: new Date(eventData.startDate),
          },
        },
      ],
    });

    if (conflictingEvent) {
      throw new ApiError(
        "This time slot conflicts with another event",
        400
      );
    }
  }

  const event = await Event.create(eventData);

  await event.populate([
    { path: "clientId", select: "name email phone" },
    { path: "venueSpaceId", select: "name capacity basePrice" },
    { path: "partners.partner", select: "name category priceType fixedRate hourlyRate" }
  ]);

  new ApiResponse({ event }, "Event created successfully", 201).send(res);
});
/**
 * @desc    Archive event (soft delete)
 * @route   DELETE /api/v1/events/:id
 * @access  Private (events.delete.all)
 */
export const archiveEvent = asyncHandler(async (req, res) => {
  const event = await Event.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
    isArchived: { $ne: true }
  });

  if (!event) {
    throw new ApiError("Event not found", 404);
  }

  const archivedEvent = await Event.archiveEvent(req.params.id, req.user._id);

  new ApiResponse({ event: archivedEvent }, "Event archived successfully").send(res);
});

/**
 * @desc    Restore archived event
 * @route   PATCH /api/v1/events/:id/restore
 * @access  Private (events.delete.all)
 */
export const restoreEvent = asyncHandler(async (req, res) => {
  const event = await Event.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
    isArchived: true
  });

  if (!event) {
    throw new ApiError("Archived event not found", 404);
  }

  const restoredEvent = await Event.restoreEvent(req.params.id);

  new ApiResponse({ event: restoredEvent }, "Event restored successfully").send(res);
});

/**
 * @desc    Get archived events
 * @route   GET /api/v1/events/archived
 * @access  Private (events.read.all)
 */
export const getArchivedEvents = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search,
  } = req.query;

  const query = { 
    venueId: req.user.venueId,
    isArchived: true 
  };

  if (search) {
    query.title = { $regex: search, $options: "i" };
  }

  const skip = (page - 1) * limit;

  const [events, total] = await Promise.all([
    Event.find(query)
      .populate("clientId", "name email phone")
      .populate("partners.partner", "name category")
      .populate("createdBy", "name email")
      .populate("archivedBy", "name email")
      .sort({ archivedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Event.countDocuments(query),
  ]);

  new ApiResponse({
    events,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit),
    },
  }).send(res);
});

/**
 * @desc    Get event statistics
 * @route   GET /api/v1/events/stats
 * @access  Private
 */
export const getEventStats = asyncHandler(async (req, res) => {
  const venueId = req.user.venueId;

  const stats = await Event.aggregate([
    { $match: { venueId, isArchived: { $ne: true } } },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalRevenue: { $sum: "$pricing.totalAmount" },
      },
    },
  ]);

  const typeStats = await Event.aggregate([
    { $match: { venueId, isArchived: { $ne: true } } },
    {
      $group: {
        _id: "$type",
        count: { $sum: 1 },
      },
    },
  ]);

  const totalEvents = await Event.countDocuments({ 
    venueId, 
    isArchived: { $ne: true } 
  });

  const upcomingEvents = await Event.countDocuments({
    venueId,
    isArchived: { $ne: true },
    startDate: { $gte: new Date() },
    status: { $in: ["pending", "confirmed"] }
  });

  new ApiResponse({
    statusStats: stats,
    typeStats,
    summary: {
      totalEvents,
      upcomingEvents
    }
  }).send(res);
});