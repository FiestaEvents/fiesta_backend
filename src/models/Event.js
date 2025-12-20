import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    // --- Core Info ---
    title: { type: String, required: true, trim: true, maxlength: 200 },
    type: {
      type: String,
      enum: ["wedding", "birthday", "corporate", "conference", "party", "other"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "in-progress", "completed", "cancelled"],
      default: "pending",
    },
    notes: { type: String, maxlength: 2000 },
    isArchived: { 
      type: Boolean, 
      default: false 
    },
    archivedAt: { 
      type: Date 
    },
    archivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    
    // --- Relations ---
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true },
    venueId: { type: mongoose.Schema.Types.ObjectId, ref: "Venue", required: true },
    venueSpaceId: { type: mongoose.Schema.Types.ObjectId, ref: "VenueSpace", required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    // --- Scheduling ---
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    startTime: { type: String, required: true }, // Format "HH:mm"
    endTime: { type: String, required: true },   // Format "HH:mm"
    guestCount: { type: Number, min: 1 },

    // --- Partners (Service Providers) ---
    partners: [
      {
        partner: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Partner",
          required: true,
        },
        service: {
          type: String,
          required: true,
        },
        cost: {
          type: Number,
          default: 0,
        },
        hours: Number,
        status: {
          type: String,
          enum: ["pending", "confirmed", "completed", "cancelled"],
          default: "pending",
        },
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
      taxRate: { type: Number, default: 19 }, // Percentage (e.g., 19 for 19%)
      
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
    // SUPPLY MANAGEMENT
    // ======================================================
    supplies: [
      {
        supply: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Supply",
          required: true,
        },
        
        // Snapshot of supply details (in case supply is deleted)
        supplyName: { type: String, required: true },
        supplyCategoryId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "SupplyCategory",
        },
        supplyCategoryName: String,
        supplyUnit: String,
        
        // Allocation Details
        quantityRequested: {
          type: Number,
          required: true,
          min: [1, "Quantity must be at least 1"],
        },
        
        quantityAllocated: {
          type: Number,
          default: 0,
          min: 0,
        },
        
        // Pricing
        costPerUnit: { type: Number, default: 0 }, // Venue's cost
        chargePerUnit: { type: Number, default: 0 }, // What client pays
        pricingType: {
          type: String,
          enum: ["included", "chargeable", "optional"],
          default: "included",
        },
        
        totalCost: { type: Number, default: 0 }, // Total venue cost
        totalCharge: { type: Number, default: 0 }, // Total client charge
        
        // Status Tracking
        status: {
          type: String,
          enum: ["pending", "allocated", "delivered", "cancelled"],
          default: "pending",
        },
        
        deliveryDate: Date,
        deliveredBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        
        notes: String,
        
        // Timestamps
        requestedAt: { type: Date, default: Date.now },
        allocatedAt: Date,
      },
    ],

    // Summary of supply costs
    supplySummary: {
      totalCost: { type: Number, default: 0 },      // What venue spends
      totalCharge: { type: Number, default: 0 },    // What client pays
      totalMargin: { type: Number, default: 0 },    // Profit margin
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
      // Calculate totals for each supply item
      item.totalCost = item.quantityAllocated * item.costPerUnit;
      item.totalCharge = item.quantityAllocated * item.chargePerUnit;
      
      totalCost += item.totalCost;
      
      // Only add to charge if it's chargeable
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
    // 1. Calculate Services Total
    const servicesTotal = (this.pricing.additionalServices || []).reduce(
      (sum, item) => sum + (item.price || 0),
      0
    );

    // 2. Add chargeable supplies if not included in base price
    let suppliesCharge = 0;
    if (!this.supplySummary.includeInBasePrice && this.supplySummary) {
      suppliesCharge = this.supplySummary.totalCharge || 0;
    }

    // 3. Calculate Total Before Tax
    const subtotal = (this.pricing.basePrice || 0) + servicesTotal + suppliesCharge;
    const beforeTax = Math.max(0, subtotal - (this.pricing.discount || 0));

    // 4. Calculate Tax Amount
    const taxAmount = beforeTax * ((this.pricing.taxRate || 0) / 100);

    // 5. Set Final Values
    this.pricing.totalPriceBeforeTax = Number(beforeTax.toFixed(2));
    this.pricing.totalPriceAfterTax = Number((beforeTax + taxAmount).toFixed(2));
    
    // Auto-update payment status
    if (this.paymentInfo.paidAmount >= this.pricing.totalPriceAfterTax && this.pricing.totalPriceAfterTax > 0) {
      this.paymentInfo.status = "paid";
    } else if (this.paymentInfo.paidAmount > 0) {
      this.paymentInfo.status = "partial";
    }
  }
  next();
});

// ======================================================
// 4. MIDDLEWARE: Collision Detection
// ======================================================
eventSchema.pre("save", async function (next) {
  if (
    !this.isModified("venueSpaceId") &&
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
  const conflict = await Event.findOne({
    venueSpaceId: this.venueSpaceId,
    _id: { $ne: this._id },
    status: { $ne: "cancelled" },
    isArchived: false,
    $or: [{ startDate: { $lte: this.endDate }, endDate: { $gte: this.startDate } }],
  });

  if (conflict) {
    const existingStart = createDateTime(conflict.startDate, conflict.startTime);
    const existingEnd = createDateTime(conflict.endDate, conflict.endTime);
    
    if (start < existingEnd && end > existingStart) {
      return next(new Error("Time slot conflict detected for this venue space."));
    }
  }
  next();
});

// ======================================================
// 5. STATIC METHODS: Supply Management
// ======================================================

// Allocate supplies to event from inventory
eventSchema.methods.allocateSupplies = async function (userId) {
  const Supply = mongoose.model("Supply");
  
  for (let item of this.supplies) {
    if (item.status === "pending" && item.quantityRequested > 0) {
      try {
        // Check if enough stock
        const supply = await Supply.findById(item.supply);
        if (!supply) continue;
        
        if (supply.currentStock < item.quantityRequested) {
          throw new Error(`Insufficient stock for ${supply.name}. Available: ${supply.currentStock}, Requested: ${item.quantityRequested}`);
        }
        
        // Allocate from inventory
        await Supply.allocateToEvent(
          item.supply,
          item.quantityRequested,
          this._id,
          userId
        );
        
        // Update item status
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

// Return supplies back to inventory (e.g., on event cancellation)
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

// Mark supplies as delivered
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
eventSchema.index({ venueSpaceId: 1, startDate: 1, endDate: 1 });
eventSchema.index({ clientId: 1 });
eventSchema.index({ "supplies.supply": 1 });
eventSchema.index({ venueId: 1, startDate: 1 });
eventSchema.index({ "partners.partner": 1 });

// Create the model
const Event = mongoose.model("Event", eventSchema);

// Export as default
export default Event;