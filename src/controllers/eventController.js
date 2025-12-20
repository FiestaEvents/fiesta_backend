// src/controllers/eventController.js
import asyncHandler from "../middleware/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { Event, Client, Partner, Supply} from "../models/index.js";

// ==========================================
// 1. HELPER FUNCTIONS
// ==========================================

// Helper: Fetch Supply Costs & Charges
const processEventSupplies = async (suppliesInput, venueId) => {
  if (!suppliesInput || !Array.isArray(suppliesInput) || suppliesInput.length === 0) {
    return [];
  }

  const supplyIds = suppliesInput.map((s) => s.supply);
  const dbSupplies = await Supply.find({
    _id: { $in: supplyIds },
    venueId: venueId,
  }).populate("categoryId", "name"); // Populate category name if needed

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
        // ✅ FIX: Explicitly include the name here to satisfy the Schema validator
        supplyName: dbItem.name, 
        
        // Optional: Include category snapshot if your model needs it
        supplyCategory: dbItem.categoryId ? dbItem.categoryId.name : "Uncategorized",

        quantityRequested: Number(reqItem.quantityRequested) || Number(reqItem.quantity) || 1,
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
const processEventPartners = async (partnersInput, venueId) => {
  if (!partnersInput || !Array.isArray(partnersInput) || partnersInput.length === 0) return [];

  const partnerIds = partnersInput.map((p) => p.partner);
  const dbPartners = await Partner.find({ _id: { $in: partnerIds }, venueId });

  const processedServices = [];
  partnersInput.forEach((reqPartner) => {
    const fullPartner = dbPartners.find((p) => p._id.toString() === reqPartner.partner.toString());
    if (fullPartner) {
      let price = 0;
      const name = `${fullPartner.name} (${reqPartner.service || fullPartner.category})`;
      if (fullPartner.priceType === "hourly") {
        price = (Number(reqPartner.hours) || 1) * (fullPartner.hourlyRate || 0);
      } else {
        price = Number(reqPartner.cost) || fullPartner.fixedRate || 0;
      }
      processedServices.push({ name, price, partnerId: fullPartner._id, type: "partner_service" });
    }
  });
  return processedServices;
};

// 🔥 NEW HELPER: Force Calculation
const calculateTotals = (event) => {
  // 1. Base Price
  const basePrice = event.pricing?.basePrice || 0;

  // 2. Services (Partners + Extras)
  const servicesTotal = event.pricing?.additionalServices?.reduce((sum, s) => sum + (s.price || 0), 0) || 0;

  // 3. Supplies (The missing part!)
  const suppliesTotal = event.supplies?.reduce((sum, s) => {
    if (s.pricingType === "chargeable") {
      return sum + (s.quantityRequested * s.chargePerUnit);
    }
    return sum;
  }, 0) || 0;

  // 4. Subtotal
  const subtotal = basePrice + servicesTotal + suppliesTotal;

  // 5. Discount
  let discountAmount = 0;
  if (event.pricing?.discountType === "percent") {
    discountAmount = subtotal * ((event.pricing.discountAmount || 0) / 100);
  } else {
    discountAmount = event.pricing?.discountAmount || 0;
  }

  // 6. Tax
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const taxAmount = taxableAmount * ((event.pricing?.taxRate || 0) / 100);

  // 7. Final Total
  const total = taxableAmount + taxAmount;

  // Update the Event Object directly
  if (!event.pricing) event.pricing = {};
  event.pricing.totalPriceBeforeTax = subtotal;
  event.pricing.totalPriceAfterTax = total; // This is what shows on the card
  
  return event;
};
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
    .populate("partners.partner", "name email phone category company")
    .populate("paymentInfo.transactions")
    .populate("createdBy", "name email")
  .populate({
      path: "supplies.supply",
      select: "name unit currentStock minimumStock categoryId costPerUnit chargePerUnit pricingType",
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
  const userVenueId = req.user.venueId._id || req.user.venueId;
  const eventData = { ...req.body, venueId: userVenueId, createdBy: req.user._id };

  const client = await Client.findOne({ _id: eventData.clientId, venueId: userVenueId });
  if (!client) throw new ApiError("Client not found", 404);

  // Process Supplies
  if (eventData.supplies?.length > 0) {
    eventData.supplies = await processEventSupplies(eventData.supplies, userVenueId);
  }

  // Process Partners
  if (eventData.partners?.length > 0) {
    if (!eventData.pricing) eventData.pricing = {};
    if (!eventData.pricing.additionalServices) eventData.pricing.additionalServices = [];
    const partnerServices = await processEventPartners(eventData.partners, userVenueId);
    eventData.pricing.additionalServices.push(...partnerServices);
  }

  // Create Instance
  const event = new Event(eventData);

  // 🛑 FORCE CALCULATION BEFORE SAVE
  calculateTotals(event);

  try {
    await event.save();
    await event.populate([{ path: "clientId" }, { path: "venueSpaceId" }]);
    new ApiResponse({ event }, "Event created successfully", 201).send(res);
  } catch (error) {
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
  const userVenueId = req.user.venueId._id || req.user.venueId;

  let event = await Event.findById(id);
  if (!event) throw new ApiError("Event not found", 404);
  if (event.venueId.toString() !== userVenueId.toString()) throw new ApiError("Not authorized", 403);

  // 1. Client Update
  if (updateData.clientId && updateData.clientId !== event.clientId.toString()) {
    event.clientId = updateData.clientId;
  }

  // 2. Supplies Update
  if (updateData.supplies) {
    event.supplies = await processEventSupplies(updateData.supplies, userVenueId);
  }

  // 3. Partners Update
  if (updateData.partners) {
    const partnerServices = await processEventPartners(updateData.partners, userVenueId);
    if (!event.pricing) event.pricing = {};
    // Keep non-partner services (manual ones)
    const manualServices = (event.pricing.additionalServices || []).filter(s => s.type !== "partner_service");
    event.pricing.additionalServices = [...manualServices, ...partnerServices];
    event.partners = updateData.partners;
  }

  // 4. Basic Fields & Manual Pricing
  const exclude = ["partners", "supplies", "pricing"];
  Object.keys(updateData).forEach((key) => {
    if (!exclude.includes(key)) event[key] = updateData[key];
  });

  if (updateData.pricing) {
    if (!event.pricing) event.pricing = {};
    if (updateData.pricing.basePrice !== undefined) event.pricing.basePrice = updateData.pricing.basePrice;
    if (updateData.pricing.discountAmount !== undefined) event.pricing.discountAmount = updateData.pricing.discountAmount;
    if (updateData.pricing.taxRate !== undefined) event.pricing.taxRate = updateData.pricing.taxRate;
    // Manual services update
    if (updateData.pricing.additionalServices && !updateData.partners) {
      event.pricing.additionalServices = updateData.pricing.additionalServices;
    }
  }

  // 🛑 FORCE CALCULATION BEFORE SAVE
  calculateTotals(event);

  try {
    await event.save();
    await event.populate([{ path: "clientId" }, { path: "venueSpaceId" }]);
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

/**
 * @desc    Allocate supplies to event from inventory
 * @route   POST /api/events/:id/supplies/allocate
 * @access  Private
 */
export const allocateEventSupplies = asyncHandler(async (req, res) => {
  const event = await Event.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  });

  if (!event) {
    res.status(404);
    throw new Error("Event not found");
  }

  // Check if event already has allocated supplies
  const hasAllocated = event.supplies?.some(
    (s) => s.status === "allocated" || s.status === "delivered"
  );

  if (hasAllocated) {
    res.status(400);
    throw new Error("Supplies already allocated to this event");
  }

  try {
    // Call the event method to allocate supplies
    await event.allocateSupplies(req.user._id);

    // Populate supply details for response
    await event.populate("supplies.supply");

    res.status(200).json({
      success: true,
      message: "Supplies allocated successfully",
      data: event,
    });
  } catch (error) {
    res.status(400);
    throw new Error(error.message || "Failed to allocate supplies");
  }
});

/**
 * @desc    Return supplies back to inventory (e.g., on cancellation)
 * @route   POST /api/events/:id/supplies/return
 * @access  Private
 */
export const returnEventSupplies = asyncHandler(async (req, res) => {
  const event = await Event.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  });

  if (!event) {
    res.status(404);
    throw new Error("Event not found");
  }

  // Check if event has supplies to return
  if (!event.supplies || event.supplies.length === 0) {
    res.status(400);
    throw new Error("No supplies to return");
  }

  try {
    await event.returnSupplies(req.user._id);

    res.status(200).json({
      success: true,
      message: "Supplies returned to inventory successfully",
      data: event,
    });
  } catch (error) {
    res.status(400);
    throw new Error(error.message || "Failed to return supplies");
  }
});

/**
 * @desc    Mark supplies as delivered
 * @route   PATCH /api/events/:id/supplies/delivered
 * @access  Private
 */
export const markSuppliesDelivered = asyncHandler(async (req, res) => {
  const event = await Event.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  });

  if (!event) {
    res.status(404);
    throw new Error("Event not found");
  }

  // Check if event has allocated supplies
  const hasAllocated = event.supplies?.some((s) => s.status === "allocated");

  if (!hasAllocated) {
    res.status(400);
    throw new Error("No allocated supplies to mark as delivered");
  }

  try {
    await event.markSuppliesDelivered(req.user._id);

    res.status(200).json({
      success: true,
      message: "Supplies marked as delivered",
      data: event,
    });
  } catch (error) {
    res.status(400);
    throw new Error(error.message || "Failed to mark supplies as delivered");
  }
});