import asyncHandler from "../middleware/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { Event, Client, Partner, Supply } from "../models/index.js";

// ==========================================
// 1. HELPER FUNCTIONS
// ==========================================

/**
 * Safely extract the Business ID string from a request object,
 * handling both populated objects and raw IDs.
 */
const getBusinessIdString = (req) => {
  // Check req.businessId (set by middleware) or req.user.businessId
  const source = req.businessId || req.user?.businessId;

  if (!source) return null;

  // If it's an object with an _id property (populated), return _id
  if (typeof source === "object" && source._id) {
    return source._id.toString();
  }

  // Otherwise assume it's already an ID
  return source.toString();
};

// Helper: Fetch Supply Costs & Charges
const processEventSupplies = async (suppliesInput, businessId) => {
  if (
    !suppliesInput ||
    !Array.isArray(suppliesInput) ||
    suppliesInput.length === 0
  ) {
    return [];
  }

  const supplyIds = suppliesInput.map((s) => s.supply);
  const dbSupplies = await Supply.find({
    _id: { $in: supplyIds },
    businessId: businessId,
  }).populate("categoryId", "name");

  return suppliesInput
    .map((reqItem) => {
      const dbItem = dbSupplies.find(
        (s) => s._id.toString() === reqItem.supply.toString()
      );

      if (!dbItem) return null;

      let finalCharge = 0;
      if (dbItem.pricingType === "chargeable") {
        finalCharge =
          reqItem.chargePerUnit !== undefined
            ? Number(reqItem.chargePerUnit)
            : dbItem.chargePerUnit;
      }

      return {
        supply: dbItem._id,
        supplyName: dbItem.name,
        supplyCategory: dbItem.categoryId
          ? dbItem.categoryId.name
          : "Uncategorized",
        quantityRequested:
          Number(reqItem.quantityRequested) || Number(reqItem.quantity) || 1,
        quantityAllocated: 0,
        costPerUnit: Number(dbItem.costPerUnit) || 0,
        chargePerUnit: Number(finalCharge),
        pricingType: dbItem.pricingType,
        unit: dbItem.unit,
        status: reqItem.status || "pending",
      };
    })
    .filter(Boolean);
};

// Helper: Fetch Partner Services
const processEventPartners = async (partnersInput, businessId) => {
  if (
    !partnersInput ||
    !Array.isArray(partnersInput) ||
    partnersInput.length === 0
  )
    return [];

  const partnerIds = partnersInput.map((p) => p.partner);
  const dbPartners = await Partner.find({
    _id: { $in: partnerIds },
    businessId,
  });

  const processedServices = [];
  partnersInput.forEach((reqPartner) => {
    const fullPartner = dbPartners.find(
      (p) => p._id.toString() === reqPartner.partner.toString()
    );
    if (fullPartner) {
      let price = 0;
      const name = `${fullPartner.name} (${
        reqPartner.service || fullPartner.category
      })`;
      if (fullPartner.priceType === "hourly") {
        price = (Number(reqPartner.hours) || 1) * (fullPartner.hourlyRate || 0);
      } else {
        price = Number(reqPartner.cost) || fullPartner.fixedRate || 0;
      }
      processedServices.push({
        name,
        price,
        partnerId: fullPartner._id,
        type: "partner_service",
      });
    }
  });
  return processedServices;
};

// Helper: Force Calculation
const calculateTotals = (event) => {
  const basePrice = event.pricing?.basePrice || 0;

  const servicesTotal =
    event.pricing?.additionalServices?.reduce(
      (sum, s) => sum + (s.price || 0),
      0
    ) || 0;

  const suppliesTotal =
    event.supplies?.reduce((sum, s) => {
      if (s.pricingType === "chargeable") {
        return sum + s.quantityRequested * s.chargePerUnit;
      }
      return sum;
    }, 0) || 0;

  const subtotal = basePrice + servicesTotal + suppliesTotal;

  let discountAmount = 0;
  if (event.pricing?.discountType === "percent") {
    discountAmount = subtotal * ((event.pricing.discountAmount || 0) / 100);
  } else {
    discountAmount = event.pricing?.discountAmount || 0;
  }

  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const taxAmount = taxableAmount * ((event.pricing?.taxRate || 0) / 100);
  const total = taxableAmount + taxAmount;

  if (!event.pricing) event.pricing = {};
  event.pricing.totalPriceBeforeTax = subtotal;
  event.pricing.totalPriceAfterTax = total;

  return event;
};

// ==========================================
// 2. CONTROLLERS
// ==========================================

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

  const businessId = getBusinessIdString(req);
  if (!businessId) throw new ApiError("User not linked to business", 403);

  const query = { businessId };

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
      .populate("resourceId", "name type capacity")
      .populate("partners.partner", "name category company phone")
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
  const businessId = getBusinessIdString(req);

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
    businessId,
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

  const statsQuery = { ...query, isArchived: { $ne: true } };
  const stats = await Event.aggregate([
    { $match: statsQuery },
    {
      $group: {
        _id: null,
        totalEvents: { $sum: 1 },
        totalRevenue: { $sum: "$pricing.totalPriceAfterTax" },
        totalPaid: { $sum: "$paymentInfo.paidAmount" },
        upcomingEvents: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gt: ["$startDate", new Date()] },
                  { $ne: ["$status", "cancelled"] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  const clientStats = stats[0] || {
    totalEvents: 0,
    totalRevenue: 0,
    totalPaid: 0,
    upcomingEvents: 0,
  };

  new ApiResponse({
    events,
    stats: {
      ...clientStats,
      pendingAmount: clientStats.totalRevenue - clientStats.totalPaid,
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
  const businessId = getBusinessIdString(req);
  const event = await Event.findOne({
    _id: req.params.id,
    businessId,
  })
    .populate("clientId")
    .populate("resourceId")
    .populate("partners.partner", "name email phone category company")
    .populate("paymentInfo.transactions")
    .populate("createdBy", "name email")
    .populate({
      path: "supplies.supply",
      select:
        "name unit currentStock minimumStock categoryId costPerUnit chargePerUnit pricingType",
      populate: {
        path: "categoryId",
        select: "name nameAr nameFr color icon",
      },
    });

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
  const businessId = getBusinessIdString(req);
  if (!businessId) throw new ApiError("User not linked to business", 403);

  const eventData = {
    ...req.body,
    businessId: businessId,
    createdBy: req.user._id,
    resourceId: req.body.resourceId || req.body.venueSpaceId,
  };

  const client = await Client.findOne({ _id: eventData.clientId, businessId });
  if (!client) throw new ApiError("Client not found", 404);

  if (eventData.supplies?.length > 0) {
    eventData.supplies = await processEventSupplies(
      eventData.supplies,
      businessId
    );
  }

  if (eventData.partners?.length > 0) {
    if (!eventData.pricing) eventData.pricing = {};
    if (!eventData.pricing.additionalServices)
      eventData.pricing.additionalServices = [];
    const partnerServices = await processEventPartners(
      eventData.partners,
      businessId
    );
    eventData.pricing.additionalServices.push(...partnerServices);
  }

  const event = new Event(eventData);
  calculateTotals(event);

  try {
    await event.save();
    await event.populate([{ path: "clientId" }, { path: "resourceId" }]);
    new ApiResponse({ event }, "Event created successfully", 201).send(res);
  } catch (error) {
    if (
      error.message.includes("conflict") ||
      error.message.includes("End time")
    ) {
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

  // FIX: Use Robust Helper
  const userBizIdStr = getBusinessIdString(req);

  if (!userBizIdStr) {
    console.error("❌ CRITICAL: User has no Business ID attached.");
    throw new ApiError("User context invalid", 401);
  }

  let event = await Event.findById(id);
  if (!event) throw new ApiError("Event not found", 404);

  const eventBizIdStr = event.businessId?.toString();

  if (eventBizIdStr !== userBizIdStr) {
    console.log(
      `⚠️ Tenant Mismatch! Event: ${eventBizIdStr} vs User: ${userBizIdStr}`
    );
    throw new ApiError("Not authorized to update this event", 403);
  }

  // 1. Client Update
  if (
    updateData.clientId &&
    updateData.clientId !== event.clientId?.toString()
  ) {
    event.clientId = updateData.clientId;
  }

  // 2. Supplies Update
  if (updateData.supplies) {
    event.supplies = await processEventSupplies(
      updateData.supplies,
      userBizIdStr
    );
  }

  // 3. Partners Update
  if (updateData.partners) {
    const partnerServices = await processEventPartners(
      updateData.partners,
      userBizIdStr
    );
    if (!event.pricing) event.pricing = {};
    const manualServices = (event.pricing.additionalServices || []).filter(
      (s) => s.type !== "partner_service"
    );
    event.pricing.additionalServices = [...manualServices, ...partnerServices];
    event.partners = updateData.partners;
  }

  // 4. Basic Fields & Mapping
  const exclude = ["partners", "supplies", "pricing"];
  if (updateData.venueSpaceId) updateData.resourceId = updateData.venueSpaceId;

  Object.keys(updateData).forEach((key) => {
    if (!exclude.includes(key)) event[key] = updateData[key];
  });

  // 5. Pricing
  if (updateData.pricing) {
    if (!event.pricing) event.pricing = {};
    if (updateData.pricing.basePrice !== undefined)
      event.pricing.basePrice = updateData.pricing.basePrice;
    if (updateData.pricing.discountAmount !== undefined)
      event.pricing.discountAmount = updateData.pricing.discountAmount;
    if (updateData.pricing.taxRate !== undefined)
      event.pricing.taxRate = updateData.pricing.taxRate;

    if (updateData.pricing.additionalServices && !updateData.partners) {
      event.pricing.additionalServices = updateData.pricing.additionalServices;
    }
  }

  calculateTotals(event);

  try {
    await event.save();
    await event.populate([{ path: "clientId" }, { path: "resourceId" }]);
    new ApiResponse({ event }, "Event updated successfully").send(res);
  } catch (error) {
    throw new ApiError(error.message, 400);
  }
});

/**
 * @desc    Archive event
 * @route   DELETE /api/v1/events/:id
 * @access  Private
 */
export const archiveEvent = asyncHandler(async (req, res) => {
  const businessId = getBusinessIdString(req);
  const event = await Event.findOneAndUpdate(
    { _id: req.params.id, businessId },
    {
      isArchived: true,
      archivedAt: new Date(),
      archivedBy: req.user._id,
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
  const businessId = getBusinessIdString(req);
  const event = await Event.findOneAndUpdate(
    { _id: req.params.id, businessId },
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
  const businessId = getBusinessIdString(req);
  if (!businessId) throw new ApiError("User context invalid", 403);

  // Note: Aggregation pipeline needs explicit ObjectID if we want to match exact types
  // But usually strings work if mongoose handles casting. For safety, ensure businessId is passed correctly.

  // Since we have the ID string, we might need to cast it for aggregation if it was stored as ObjectId
  // But usually businessId in Schema is ObjectId.
  // We can use mongoose.Types.ObjectId(businessId) inside match if needed.
  // For now, let's assume standard behavior.

  const stats = await Event.aggregate([
    {
      $match: {
        businessId: {
          $eq: new (require("mongoose").Types.ObjectId)(businessId),
        },
        isArchived: { $ne: true },
      },
    },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalRevenue: { $sum: "$pricing.totalPriceAfterTax" },
      },
    },
  ]);

  const typeStats = await Event.aggregate([
    {
      $match: {
        businessId: {
          $eq: new (require("mongoose").Types.ObjectId)(businessId),
        },
        isArchived: { $ne: true },
      },
    },
    {
      $group: {
        _id: "$type",
        count: { $sum: 1 },
      },
    },
  ]);

  const totalEvents = await Event.countDocuments({
    businessId,
    isArchived: { $ne: true },
  });

  const upcomingEvents = await Event.countDocuments({
    businessId,
    isArchived: { $ne: true },
    startDate: { $gte: new Date() },
    status: { $in: ["pending", "confirmed"] },
  });

  new ApiResponse({
    statusStats: stats,
    typeStats,
    summary: {
      totalEvents,
      upcomingEvents,
    },
  }).send(res);
});

/**
 * @desc    Allocate supplies to event
 * @route   POST /api/events/:id/supplies/allocate
 * @access  Private
 */
export const allocateEventSupplies = asyncHandler(async (req, res) => {
  const businessId = getBusinessIdString(req);
  const event = await Event.findOne({
    _id: req.params.id,
    businessId,
  });

  if (!event) throw new ApiError("Event not found", 404);

  const hasAllocated = event.supplies?.some(
    (s) => s.status === "allocated" || s.status === "delivered"
  );

  if (hasAllocated)
    throw new ApiError("Supplies already allocated to this event", 400);

  try {
    await event.allocateSupplies(req.user._id);
    await event.populate("supplies.supply");

    res.status(200).json({
      success: true,
      message: "Supplies allocated successfully",
      data: event,
    });
  } catch (error) {
    throw new ApiError(error.message || "Failed to allocate supplies", 400);
  }
});

/**
 * @desc    Return supplies back to inventory
 * @route   POST /api/events/:id/supplies/return
 * @access  Private
 */
export const returnEventSupplies = asyncHandler(async (req, res) => {
  const businessId = getBusinessIdString(req);
  const event = await Event.findOne({
    _id: req.params.id,
    businessId,
  });

  if (!event) throw new ApiError("Event not found", 404);

  if (!event.supplies || event.supplies.length === 0) {
    throw new ApiError("No supplies to return", 400);
  }

  try {
    await event.returnSupplies(req.user._id);

    res.status(200).json({
      success: true,
      message: "Supplies returned to inventory successfully",
      data: event,
    });
  } catch (error) {
    throw new ApiError(error.message || "Failed to return supplies", 400);
  }
});

/**
 * @desc    Mark supplies as delivered
 * @route   PATCH /api/events/:id/supplies/delivered
 * @access  Private
 */
export const markSuppliesDelivered = asyncHandler(async (req, res) => {
  const businessId = getBusinessIdString(req);
  const event = await Event.findOne({
    _id: req.params.id,
    businessId,
  });

  if (!event) throw new ApiError("Event not found", 404);

  const hasAllocated = event.supplies?.some((s) => s.status === "allocated");

  if (!hasAllocated)
    throw new ApiError("No allocated supplies to mark as delivered", 400);

  try {
    await event.markSuppliesDelivered(req.user._id);

    res.status(200).json({
      success: true,
      message: "Supplies marked as delivered",
      data: event,
    });
  } catch (error) {
    throw new ApiError(
      error.message || "Failed to mark supplies as delivered",
      400
    );
  }
});
