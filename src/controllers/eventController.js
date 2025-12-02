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

  if (includeArchived !== "true" && includeArchived !== true) {
    query.isArchived = { $ne: true };
  }

  const skip = (page - 1) * limit;

  const [events, total] = await Promise.all([
    Event.find(query)
      .populate("clientId", "name email phone")
      .populate("createdBy", "name email")
      .populate("venueSpaceId", "name")
      .populate("partners.partner", "name email phone category") 
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

  const query = {
    clientId: clientId,
    venueId: req.user.venueId,
  };

  if (status) query.status = status;
  if (includeArchived !== "true" && includeArchived !== true) {
    query.isArchived = { $ne: true };
  }

  const skip = (page - 1) * limit;
  const sortOptions = { [sortBy]: order === "asc" ? 1 : -1 };

  const [events, total] = await Promise.all([
    Event.find(query)
      .populate("clientId", "name email phone")
      .populate("createdBy", "name email")
      .populate("partners.partner", "name email phone category")
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit)),
    Event.countDocuments(query),
  ]);

  // Statistics Aggregation
  const statsQuery = { ...query, isArchived: { $ne: true } };
  const stats = await Event.aggregate([
    { $match: statsQuery },
    {
      $group: {
        _id: null,
        totalEvents: { $sum: 1 },
        // Updated to use new model fields
        totalRevenue: { $sum: "$pricing.totalPriceAfterTax" },
        totalPaid: { $sum: "$paymentInfo.paidAmount" },
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
    .populate("venueSpaceId")
    .populate("partners.partner", "name email phone category company") // ✅ Add this line
    .populate("paymentInfo.transactions")
    .populate("createdBy", "name email");

  if (!event) {
    throw new ApiError("Event not found", 404);
  }

  new ApiResponse({ event }).send(res);
});

/**
 * @desc    Create new event
 * @route   POST /api/v1/events
 * @access  Private
 */
export const createEvent = asyncHandler(async (req, res) => {
  const userVenueId = req.user.venueId._id ? req.user.venueId._id : req.user.venueId;

  const eventData = {
    ...req.body,
    venueId: userVenueId,
    createdBy: req.user._id,
  };

  // 1. Ensure Client Exists
  const client = await Client.findOne({
    _id: eventData.clientId,
    venueId: userVenueId,
  });
  if (!client) throw new ApiError("Client not found", 404);

  // 2. HELPER: Convert "Partners" (if sent) to "AdditionalServices"
  // This allows the frontend to still send partner IDs, but we store them as simple services
  if (eventData.partners && Array.isArray(eventData.partners) && eventData.partners.length > 0) {
    const partnerIds = eventData.partners.map(p => p.partner);
    const dbPartners = await Partner.find({ _id: { $in: partnerIds }, venueId: userVenueId });

    // Ensure pricing object exists
    if (!eventData.pricing) eventData.pricing = {};
    if (!eventData.pricing.additionalServices) eventData.pricing.additionalServices = [];

    eventData.partners.forEach(reqPartner => {
      const fullPartner = dbPartners.find(p => p._id.toString() === reqPartner.partner.toString());
      if (fullPartner) {
        let price = 0;
        const name = `${fullPartner.name} (${reqPartner.service || fullPartner.category})`;

        if (fullPartner.priceType === "hourly") {
          price = (reqPartner.hours || 1) * (fullPartner.hourlyRate || 0);
        } else {
          price = reqPartner.cost || fullPartner.fixedRate || 0;
        }

        // Add to services list
        eventData.pricing.additionalServices.push({ name, price });
      }
    });
  }

  // 3. Create Event
  // NOTE: collision check and tax calculation happen automatically in the Model's pre('save') hook.
  try {
    const event = new Event(eventData);
    await event.save(); // This triggers the hooks

    await event.populate([
      { path: "clientId", select: "name email phone" },
      { path: "venueSpaceId", select: "name" }
    ]);

    new ApiResponse({ event }, "Event created successfully", 201).send(res);
  } catch (error) {
    // Catch specific error messages from the Model Hook
    if (error.message.includes("conflict") || error.message.includes("End time")) {
      throw new ApiError(error.message, 400);
    }
    throw error;
  }
});

/**
 * @desc    Update event
 * @route   PUT /api/v1/events/:id
 * @access  Private
 */
export const updateEvent = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;
  const userVenueId = req.user.venueId._id ? req.user.venueId._id.toString() : req.user.venueId.toString();

  // 1. Find Event
  let event = await Event.findById(id);
  if (!event) throw new ApiError("Event not found", 404);

  if (event.venueId.toString() !== userVenueId) {
    throw new ApiError("Not authorized to update this event", 403);
  }

  // 2. Handle Client Change
  if (updateData.clientId && updateData.clientId !== event.clientId.toString()) {
    const client = await Client.findOne({ _id: updateData.clientId, venueId: userVenueId });
    if (!client) throw new ApiError("Client not found", 404);
    event.clientId = updateData.clientId;
  }

  // 3. Handle Partners -> Additional Services Conversion (Replaces old list if sent)
  if (updateData.partners && Array.isArray(updateData.partners)) {
    const partnerIds = updateData.partners.map(p => p.partner);
    const dbPartners = await Partner.find({ _id: { $in: partnerIds }, venueId: userVenueId });

    const newServices = [];
    
    updateData.partners.forEach(reqPartner => {
      const fullPartner = dbPartners.find(p => p._id.toString() === reqPartner.partner.toString());
      if (fullPartner) {
        let price = 0;
        const name = `${fullPartner.name} (${reqPartner.service || fullPartner.category})`;
        
        if (fullPartner.priceType === "hourly") {
          price = (reqPartner.hours || 1) * (fullPartner.hourlyRate || 0);
        } else {
          price = reqPartner.cost || fullPartner.fixedRate || 0;
        }
        newServices.push({ name, price });
      }
    });

    // Initialize pricing if missing
    if (!event.pricing) event.pricing = {};
    
    // We append these to existing services or replace? 
    // Assuming replace for simplicity if "partners" field is sent
    if (!updateData.pricing) updateData.pricing = { ...event.pricing };
    updateData.pricing.additionalServices = [
      ...(updateData.pricing.additionalServices || []), // Keep manually added services
      ...newServices // Add partner services
    ];
  }

  // 4. Apply Updates manually to trigger 'save' hooks
  // We cannot use findByIdAndUpdate if we want the Tax/Total & Collision hooks to run
  Object.keys(updateData).forEach((key) => {
    // Skip partners field as we handled it above
    if (key !== 'partners') {
      event[key] = updateData[key];
    }
  });

  // 5. Save (Triggers Model Hooks for Math & Collision)
  try {
    await event.save();
  } catch (error) {
    if (error.message.includes("conflict") || error.message.includes("End time")) {
      throw new ApiError(error.message, 400);
    }
    throw error;
  }

  await event.populate([
    { path: "clientId", select: "name email phone" },
    { path: "venueSpaceId", select: "name" }
  ]);

  new ApiResponse({ event }, "Event updated successfully").send(res);
});

/**
 * @desc    Archive event
 * @route   DELETE /api/v1/events/:id
 * @access  Private
 */
export const archiveEvent = asyncHandler(async (req, res) => {
  const event = await Event.findOneAndUpdate(
    { _id: req.params.id, venueId: req.user.venueId },
    { 
      isArchived: true, 
      archivedAt: new Date(),
      archivedBy: req.user._id // <--- Now we save the user ID
    },
    { new: true }
  );

  if (!event) throw new ApiError("Event not found", 404);

  new ApiResponse({ event }, "Event archived successfully").send(res);
});

/**
 * @desc    Restore event
 * @route   PATCH /api/v1/events/:id/restore
 * @access  Private
 */
export const restoreEvent = asyncHandler(async (req, res) => {
  const event = await Event.findOneAndUpdate(
    { _id: req.params.id, venueId: req.user.venueId },
    { isArchived: false, archivedAt: null },
    { new: true }
  );

  if (!event) throw new ApiError("Event not found", 404);

  new ApiResponse({ event }, "Event restored successfully").send(res);
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
        // Updated field name
        totalRevenue: { $sum: "$pricing.totalPriceAfterTax" },
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