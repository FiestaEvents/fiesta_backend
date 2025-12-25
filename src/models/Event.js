import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    // --- Core Info ---
    title: { type: String, required: true, trim: true, maxlength: 200 },
    type: {
      type: String,
      // Expanded enum for Multi-Vertical support
      enum: ["wedding", "birthday", "corporate", "conference", "party", "photoshoot", "delivery", "catering_job", "concert", "other"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "in-progress", "completed", "cancelled"],
      default: "pending",
    },
    notes: { type: String, maxlength: 2000 },
    
    // Archive / Soft Delete
    isArchived: { type: Boolean, default: false },
    archivedAt: { type: Date },
    archivedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    
    // --- Relations ---
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true },
    
    // ARCHITECTURE UPDATE: Replaces venueId
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true },
    
    // POLYMORPHIC RESOURCE:
    // - For Venues: ObjectId of the 'Space' (Room)
    // - For Drivers: ObjectId of the 'Vehicle'
    // - For Photographers: Null (implies the main photographer is booked)
    resourceId: { type: mongoose.Schema.Types.ObjectId, ref: "Space" }, 
    
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    // --- Scheduling ---
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    startTime: { type: String, required: true }, // Format "HH:mm"
    endTime: { type: String, required: true },   // Format "HH:mm"
    guestCount: { type: Number, min: 1 },

    // --- Partners (External Service Providers hired for this event) ---
    partners: [
      {
        partner: { type: mongoose.Schema.Types.ObjectId, ref: "Partner", required: true },
        service: { type: String, required: true },
        cost: { type: Number, default: 0 },
        hours: Number,
        status: { type: String, enum: ["pending", "confirmed", "completed", "cancelled"], default: "pending" },
      },
    ],

    // --- Financials ---
    pricing: {
      basePrice: { type: Number, default: 0, min: 0 },
      additionalServices: [
        {
          name: String,
          price: { type: Number, default: 0 },
        },
      ],
      discount: { type: Number, default: 0, min: 0 },
      taxRate: { type: Number, default: 19 },
      
      totalPriceBeforeTax: { type: Number, default: 0 },
      totalPriceAfterTax: { type: Number, default: 0 },
    },

    // Simplified Payment Tracking
    paymentInfo: {
      paidAmount: { type: Number, default: 0 },
      status: {
        type: String,
        enum: ["unpaid", "partial", "paid", "overdue"],
        default: "unpaid",
      },
      transactions: [{ type: mongoose.Schema.Types.ObjectId, ref: "Payment" }],
    },

    // ======================================================
    // SUPPLY MANAGEMENT (Consumables for Caterers / Inventory for Venues)
    // ======================================================
    supplies: [
      {
        supply: { type: mongoose.Schema.Types.ObjectId, ref: "Supply", required: true },
        
        // Snapshot
        supplyName: { type: String, required: true },
        supplyCategoryId: { type: mongoose.Schema.Types.ObjectId, ref: "SupplyCategory" },
        supplyCategoryName: String,
        supplyUnit: String,
        
        // Allocation
        quantityRequested: { type: Number, required: true, min: 1 },
        quantityAllocated: { type: Number, default: 0, min: 0 },
        
        // Pricing
        costPerUnit: { type: Number, default: 0 }, // Business cost
        chargePerUnit: { type: Number, default: 0 }, // Client charge
        pricingType: { type: String, enum: ["included", "chargeable", "optional"], default: "included" },
        
        totalCost: { type: Number, default: 0 },
        totalCharge: { type: Number, default: 0 },
        
        status: { type: String, enum: ["pending", "allocated", "delivered", "cancelled"], default: "pending" },
        
        deliveryDate: Date,
        deliveredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        notes: String,
        requestedAt: { type: Date, default: Date.now },
        allocatedAt: Date,
      },
    ],

    supplySummary: {
      totalCost: { type: Number, default: 0 },
      totalCharge: { type: Number, default: 0 },
      totalMargin: { type: Number, default: 0 },
      includeInBasePrice: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

// ======================================================
// 1. HELPER: Date/Time Merger
// ======================================================
const createDateTime = (date, timeStr) => {
  if (!date || !timeStr) return null;
  const d = new Date(date);
  const [hours, minutes] = timeStr.split(":");
  d.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  return d;
};

// ======================================================
// 2. MIDDLEWARE: Calculate Supply Costs
// ======================================================
eventSchema.pre("save", function (next) {
  if (this.supplies && this.supplies.length > 0) {
    let totalCost = 0;
    let totalCharge = 0;

    this.supplies.forEach((item) => {
      item.totalCost = item.quantityAllocated * item.costPerUnit;
      item.totalCharge = item.quantityAllocated * item.chargePerUnit;
      
      totalCost += item.totalCost;
      
      if (item.pricingType === "chargeable") {
        totalCharge += item.totalCharge;
      }
    });

    this.supplySummary.totalCost = Number(totalCost.toFixed(2));
    this.supplySummary.totalCharge = Number(totalCharge.toFixed(2));
    this.supplySummary.totalMargin = Number((totalCharge - totalCost).toFixed(2));
  }
  next();
});

// ======================================================
// 3. MIDDLEWARE: Automatic Price Calculation
// ======================================================
eventSchema.pre("save", function (next) {
  if (this.pricing) {
    const servicesTotal = (this.pricing.additionalServices || []).reduce(
      (sum, item) => sum + (item.price || 0), 0
    );

    let suppliesCharge = 0;
    if (!this.supplySummary.includeInBasePrice && this.supplySummary) {
      suppliesCharge = this.supplySummary.totalCharge || 0;
    }

    const subtotal = (this.pricing.basePrice || 0) + servicesTotal + suppliesCharge;
    const beforeTax = Math.max(0, subtotal - (this.pricing.discount || 0));
    const taxAmount = beforeTax * ((this.pricing.taxRate || 0) / 100);

    this.pricing.totalPriceBeforeTax = Number(beforeTax.toFixed(2));
    this.pricing.totalPriceAfterTax = Number((beforeTax + taxAmount).toFixed(2));
    
    if (this.paymentInfo.paidAmount >= this.pricing.totalPriceAfterTax && this.pricing.totalPriceAfterTax > 0) {
      this.paymentInfo.status = "paid";
    } else if (this.paymentInfo.paidAmount > 0) {
      this.paymentInfo.status = "partial";
    }
  }
  next();
});

// ======================================================
// 4. MIDDLEWARE: Smart Collision Detection (Multi-Vertical)
// ======================================================
eventSchema.pre("save", async function (next) {
  // Only run if timing or resource changed
  if (
    !this.isModified("resourceId") &&
    !this.isModified("startDate") &&
    !this.isModified("endDate") &&
    !this.isModified("startTime") &&
    !this.isModified("endTime")
  ) {
    return next();
  }

  const start = createDateTime(this.startDate, this.startTime);
  const end = createDateTime(this.endDate, this.endTime);

  if (end <= start) return next(new Error("End time must be after start time"));

  const Event = mongoose.model("Event");

  // Build the Conflict Query
  const conflictQuery = {
    businessId: this.businessId, // Always scope to the current business
    _id: { $ne: this._id },
    status: { $ne: "cancelled" },
    isArchived: false,
    // Time Overlap Logic
    $or: [{ startDate: { $lte: this.endDate }, endDate: { $gte: this.startDate } }],
  };

  // Logic Branch:
  if (this.resourceId) {
    // A. RESOURCE BASED (Venue Room or Driver Vehicle)
    conflictQuery.resourceId = this.resourceId;
  } else {
    // B. GLOBAL/SOLO BASED (Photographer/Planner)
    // Checks conflicts where no specific resource is assigned (assuming global availability)
    conflictQuery.resourceId = null;
  }

  const conflict = await Event.findOne(conflictQuery);

  if (conflict) {
    const existingStart = createDateTime(conflict.startDate, conflict.startTime);
    const existingEnd = createDateTime(conflict.endDate, conflict.endTime);
    
    if (start < existingEnd && end > existingStart) {
      const errorMsg = this.resourceId 
        ? "This resource (room/vehicle) is already booked for this time slot." 
        : "You already have an event scheduled for this time.";
      return next(new Error(errorMsg));
    }
  }
  next();
});

// ======================================================
// 5. STATIC METHODS: Supply Management
// ======================================================

eventSchema.methods.allocateSupplies = async function (userId) {
  const Supply = mongoose.model("Supply");
  
  for (let item of this.supplies) {
    if (item.status === "pending" && item.quantityRequested > 0) {
      try {
        const supply = await Supply.findById(item.supply);
        if (!supply) continue;
        
        if (supply.currentStock < item.quantityRequested) {
          throw new Error(`Insufficient stock for ${supply.name}. Available: ${supply.currentStock}`);
        }
        
        // Allocate from inventory (generic business logic)
        await Supply.allocateToEvent(
          item.supply,
          item.quantityRequested,
          this._id,
          userId
        );
        
        item.quantityAllocated = item.quantityRequested;
        item.status = "allocated";
        item.allocatedAt = new Date();
      } catch (error) {
        throw new Error(`Failed to allocate ${item.supplyName}: ${error.message}`);
      }
    }
  }
  
  await this.save();
  return this;
};

eventSchema.methods.returnSupplies = async function (userId) {
  const Supply = mongoose.model("Supply");
  
  for (let item of this.supplies) {
    if (item.status === "allocated" || item.status === "delivered") {
      try {
        await Supply.updateStock(
          item.supply,
          item.quantityAllocated,
          "return",
          `Event Cancelled: ${this._id}`,
          userId,
          `Returned from cancelled event ${this.title}`
        );
        
        item.status = "cancelled";
        item.quantityAllocated = 0;
      } catch (error) {
        console.error(`Failed to return ${item.supplyName}:`, error);
      }
    }
  }
  
  await this.save();
  return this;
};

eventSchema.methods.markSuppliesDelivered = async function (userId) {
  this.supplies.forEach(item => {
    if (item.status === "allocated") {
      item.status = "delivered";
      item.deliveryDate = new Date();
      item.deliveredBy = userId;
    }
  });
  
  await this.save();
  return this;
};

// Indexes
eventSchema.index({ businessId: 1, startDate: 1 }); // Main Dashboard Filter
eventSchema.index({ resourceId: 1, startDate: 1, endDate: 1 }); // Collision Detection
eventSchema.index({ clientId: 1 });

// ✅ USE EXPORT DEFAULT
export default mongoose.model("Event", eventSchema);