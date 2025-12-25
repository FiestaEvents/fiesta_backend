import mongoose from "mongoose";

const supplySchema = new mongoose.Schema(
  {
    // Basic Info
    name: {
      type: String,
      required: [true, "Supply name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    
    // Custom category reference
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SupplyCategory",
      required: [true, "Category is required"],
      index: true,
    },
    
    // Inventory Tracking
    unit: {
      type: String,
      required: [true, "Unit of measurement is required"],
      trim: true,
      maxlength: [20, "Unit name cannot exceed 20 characters"],
      // Examples: kg (Bakery), bottle (Bar), pack (Office), stem (Florist)
    },
    
    currentStock: {
      type: Number,
      required: [true, "Current stock is required"],
      min: [0, "Stock cannot be negative"],
      default: 0,
    },
    
    minimumStock: {
      type: Number,
      default: 10,
      min: [0, "Minimum stock cannot be negative"],
    },
    
    maximumStock: {
      type: Number,
      default: 1000,
    },
    
    // Pricing
    costPerUnit: {
      type: Number,
      required: [true, "Cost per unit is required"],
      min: [0, "Cost cannot be negative"],
      default: 0,
    },
    
    // Determines if this is included in base price or charged separately
    pricingType: {
      type: String,
      enum: ["included", "chargeable", "optional"],
      default: "included",
    },
    
    // If chargeable, price to charge client
    chargePerUnit: {
      type: Number,
      min: [0, "Charge cannot be negative"],
      default: 0,
    },
    
    // Supplier Information
    supplier: {
      name: String,
      contact: String,
      phone: String,
      email: String,
      lastOrderDate: Date,
      leadTimeDays: { type: Number, default: 7 }, // Days to restock
    },
    
    // Storage & Handling
    storage: {
      location: String,        // "Pantry", "Refrigerator", "Warehouse A"
      requiresRefrigeration: { type: Boolean, default: false },
      expiryTracking: { type: Boolean, default: false },
      shelfLife: Number,       // Days
    },
    
    // Status & Metadata
    status: {
      type: String,
      enum: ["active", "inactive", "discontinued", "out_of_stock"],
      default: "active",
      index: true,
    },
    
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
    
    archivedAt: Date,
    archivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    
    notes: {
      type: String,
      maxlength: [500, "Notes cannot exceed 500 characters"],
    },
    
    // Image for dashboard display
    image: String,
    
    // =========================================================
    // ARCHITECTURE UPDATE: Replaces venueId
    // =========================================================
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    
    // Stock History (for analytics)
    stockHistory: [
      {
        date: { type: Date, default: Date.now },
        quantity: Number,
        type: {
          type: String,
          enum: ["purchase", "usage", "adjustment", "return", "waste"],
        },
        reference: String, // Event ID or other reference
        notes: String,
        recordedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// ======================================================
// VIRTUAL: Stock Status
// ======================================================
supplySchema.virtual("stockStatus").get(function () {
  if (this.currentStock === 0) return "out_of_stock";
  if (this.currentStock <= this.minimumStock) return "low_stock";
  if (this.currentStock >= this.maximumStock) return "overstocked";
  return "adequate";
});

// ======================================================
// VIRTUAL: Total Value
// ======================================================
supplySchema.virtual("totalValue").get(function () {
  return this.currentStock * this.costPerUnit;
});

// ======================================================
// STATIC: Get Low Stock Items
// ======================================================
supplySchema.statics.getLowStockItems = async function (businessId) {
  return await this.find({
    businessId,
    status: "active",
    isArchived: false,
    $expr: { $lte: ["$currentStock", "$minimumStock"] },
  })
    .populate("categoryId")
    .sort({ currentStock: 1 });
};

// ======================================================
// STATIC: Update Stock
// ======================================================
supplySchema.statics.updateStock = async function (
  supplyId,
  quantity,
  type,
  reference,
  userId,
  notes
) {
  const supply = await this.findById(supplyId);
  if (!supply) throw new Error("Supply not found");

  // Calculate new stock
  let newStock = supply.currentStock;
  if (type === "purchase" || type === "return" || type === "adjustment") {
    newStock += quantity;
  } else if (type === "usage" || type === "waste") {
    newStock -= quantity;
  }

  if (newStock < 0) throw new Error("Insufficient stock");

  // Update stock and add history
  supply.currentStock = newStock;
  supply.stockHistory.push({
    quantity,
    type,
    reference,
    notes,
    recordedBy: userId,
  });

  // Update status if out of stock
  if (newStock === 0) {
    supply.status = "out_of_stock";
  } else if (supply.status === "out_of_stock" && newStock > 0) {
    supply.status = "active";
  }

  await supply.save();
  return supply;
};

// ======================================================
// STATIC: Allocate to Event
// ======================================================
supplySchema.statics.allocateToEvent = async function (
  supplyId,
  quantity,
  eventId,
  userId
) {
  return await this.updateStock(
    supplyId,
    quantity,
    "usage",
    `Event: ${eventId}`,
    userId,
    `Allocated to event ${eventId}`
  );
};

// ======================================================
// INDEXES
// ======================================================
supplySchema.index({ name: "text", notes: "text" });
supplySchema.index({ businessId: 1, categoryId: 1, status: 1 });
supplySchema.index({ businessId: 1, currentStock: 1 });

// ======================================================
// QUERY HELPERS
// ======================================================
supplySchema.query.active = function () {
  return this.where({ status: "active", isArchived: false });
};

supplySchema.query.lowStock = function () {
  return this.where({ $expr: { $lte: ["$currentStock", "$minimumStock"] } });
};

supplySchema.query.byCategory = function (categoryId) {
  return this.where({ categoryId });
};

export default mongoose.model("Supply", supplySchema);