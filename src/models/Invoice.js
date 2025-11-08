import mongoose from "mongoose";

const invoiceSchema = new mongoose.Schema(
  {
    venue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Venue",
      required: [true, "Venue is required"],
      index: true,
    },
    invoiceNumber: {
      type: String,
      unique: true,
      index: true,
    },
    invoiceType: {
      type: String,
      enum: ["client", "partner"],
      required: [true, "Invoice type is required"],
      default: "client",
      index: true,
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      index: true,
      required: function() {
        return this.invoiceType === "client";
      }
    },
    // Partner reference (for partner invoices)
    partner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Partner",
      index: true,
      required: function() {
        return this.invoiceType === "partner";
      }
    },
    // Denormalized recipient data (works for both clients and partners)
    recipientName: {
      type: String,
      required: [true, "Recipient name is required"],
      trim: true,
    },
    recipientEmail: {
      type: String,
      required: [true, "Recipient email is required"],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
    },
    recipientPhone: {
      type: String,
      trim: true,
    },
    recipientAddress: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
    },
    recipientCompany: {
      type: String,
      trim: true,
    },
    // Event reference (optional)
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      index: true,
    },
    issueDate: {
      type: Date,
      required: [true, "Issue date is required"],
      default: Date.now,
      index: true,
    },
    dueDate: {
      type: Date,
      required: [true, "Due date is required"],
      index: true,
    },
    items: [
      {
        description: {
          type: String,
          required: [true, "Item description is required"],
          trim: true,
          maxlength: [500, "Description cannot exceed 500 characters"],
        },
        quantity: {
          type: Number,
          required: [true, "Quantity is required"],
          min: [1, "Quantity must be at least 1"],
          default: 1,
        },
        rate: {
          type: Number,
          required: [true, "Rate is required"],
          min: [0, "Rate cannot be negative"],
        },
        amount: {
          type: Number,
          required: [true, "Amount is required"],
          min: [0, "Amount cannot be negative"],
        },
        category: {
          type: String,
          enum: [
            "venue_rental",
            "catering",
            "decoration",
            "photography",
            "music",
            "security",
            "cleaning",
            "audio_visual",
            "floral",
            "entertainment",
            "equipment",
            "service",
            "driver",
            "bakery",
            "hairstyling",
            "other",
          ],
          default: "other",
        },
      },
    ],
    subtotal: {
      type: Number,
      default: 0,
      min: [0, "Subtotal cannot be negative"],
    },
    tax: {
      type: Number,
      default: 0,
      min: [0, "Tax cannot be negative"],
    },
    taxRate: {
      type: Number,
      default: 0,
      min: [0, "Tax rate cannot be negative"],
      max: [100, "Tax rate cannot exceed 100%"],
    },
    discount: {
      type: Number,
      default: 0,
      min: [0, "Discount cannot be negative"],
    },
    discountType: {
      type: String,
      enum: ["fixed", "percentage"],
      default: "fixed",
    },
    totalAmount: {
      type: Number,
      default: 0,
      min: [0, "Total amount cannot be negative"],
    },
    status: {
      type: String,
      enum: ["draft", "sent", "paid", "partial", "overdue", "cancelled"],
      default: "draft",
      index: true,
    },
    paymentStatus: {
      amountPaid: {
        type: Number,
        default: 0,
        min: [0, "Amount paid cannot be negative"],
      },
      amountDue: {
        type: Number,
        default: 0,
      },
      lastPaymentDate: Date,
    },
    payments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Payment",
      },
    ],
    notes: {
      type: String,
      maxlength: [1000, "Notes cannot exceed 1000 characters"],
    },
    terms: {
      type: String,
      maxlength: [2000, "Terms cannot exceed 2000 characters"],
    },
    sentAt: {
      type: Date,
      index: true,
    },
    sentTo: [
      {
        email: String,
        sentAt: Date,
      },
    ],
    paidAt: {
      type: Date,
    },
    paymentMethod: {
      type: String,
      enum: [
        "cash",
        "bank_transfer",
        "credit_card",
        "debit_card",
        "check",
        "mobile_payment",
        "online",
        "other",
      ],
      default: "cash",
    },
    currency: {
      type: String,
      default: "TND",
      uppercase: true,
    },
    pdfGenerated: {
      type: Boolean,
      default: false,
    },
    pdfUrl: {
      type: String,
    },
    remindersSent: [
      {
        sentAt: Date,
        type: {
          type: String,
          enum: ["initial", "reminder", "overdue"],
        },
      },
    ],
    cancelledAt: Date,
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    cancellationReason: {
      type: String,
      maxlength: [500, "Cancellation reason cannot exceed 500 characters"],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Creator is required"],
    },
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// ============================================
// INDEXES
// ============================================
invoiceSchema.index({ venue: 1, invoiceType: 1, status: 1, dueDate: -1 });
invoiceSchema.index({ venue: 1, client: 1 });
invoiceSchema.index({ venue: 1, partner: 1 });
invoiceSchema.index({ venue: 1, issueDate: -1 });
invoiceSchema.index({ invoiceNumber: 1 }, { unique: true });

// ============================================
// VIRTUALS
// ============================================
invoiceSchema.virtual("isOverdue").get(function () {
  return (
    this.status === "sent" &&
    new Date() > this.dueDate &&
    this.paymentStatus.amountDue > 0
  );
});

invoiceSchema.virtual("daysUntilDue").get(function () {
  const today = new Date();
  const due = new Date(this.dueDate);
  const diffTime = due - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

invoiceSchema.virtual("paymentProgress").get(function () {
  if (this.totalAmount === 0) return 100;
  return Math.round((this.paymentStatus.amountPaid / this.totalAmount) * 100);
});

// ============================================
// PRE-SAVE MIDDLEWARE
// ============================================

// Generate invoice number before saving
invoiceSchema.pre("save", async function (next) {
  if (this.isNew && !this.invoiceNumber) {
    try {
      const venue = await mongoose.model("Venue").findById(this.venue);
      const count = await this.constructor.countDocuments({
        venue: this.venue,
        invoiceType: this.invoiceType
      });
      
      const prefix = venue?.name?.substring(0, 3).toUpperCase() || "INV";
      const typePrefix = this.invoiceType === "client" ? "C" : "P";
      const year = new Date().getFullYear().toString().slice(-2);
      
      this.invoiceNumber = `${prefix}-${typePrefix}-${year}-${(count + 1)
        .toString()
        .padStart(4, "0")}`;
    } catch (error) {
      const count = await this.constructor.countDocuments();
      const typePrefix = this.invoiceType === "client" ? "C" : "P";
      const year = new Date().getFullYear().toString().slice(-2);
      this.invoiceNumber = `INV-${typePrefix}-${year}-${(count + 1)
        .toString()
        .padStart(4, "0")}`;
    }
  }
  next();
});

// Calculate amounts before saving
invoiceSchema.pre("save", function (next) {
  this.calculateAmounts();
  next();
});

// Validate that either client OR partner is set, not both
invoiceSchema.pre("save", function (next) {
  if (this.invoiceType === "client" && !this.client) {
    return next(new Error("Client is required for client invoices"));
  }
  if (this.invoiceType === "partner" && !this.partner) {
    return next(new Error("Partner is required for partner invoices"));
  }
  if (this.client && this.partner) {
    return next(new Error("Invoice cannot have both client and partner"));
  }
  next();
});

// ============================================
// INSTANCE METHODS
// ============================================

/**
 * Calculate all amounts
 */
invoiceSchema.methods.calculateAmounts = function () {
  this.items.forEach((item) => {
    item.amount = item.quantity * item.rate;
  });

  this.subtotal = this.items.reduce((sum, item) => sum + item.amount, 0);

  if (this.taxRate > 0) {
    this.tax = (this.subtotal * this.taxRate) / 100;
  } else {
    this.tax = 0;
  }

  let discountAmount = this.discount;
  if (this.discountType === "percentage") {
    discountAmount = (this.subtotal * this.discount) / 100;
  }

  this.totalAmount = Math.max(0, this.subtotal + this.tax - discountAmount);

  if (!this.paymentStatus) {
    this.paymentStatus = {
      amountPaid: 0,
      amountDue: this.totalAmount,
    };
  } else {
    this.paymentStatus.amountDue = Math.max(
      0,
      this.totalAmount - (this.paymentStatus.amountPaid || 0)
    );
  }

  const now = new Date();
  if (
    this.paymentStatus.amountPaid >= this.totalAmount &&
    this.status !== "cancelled"
  ) {
    this.status = "paid";
    if (!this.paidAt) {
      this.paidAt = now;
    }
  } else if (
    this.paymentStatus.amountPaid > 0 &&
    this.paymentStatus.amountPaid < this.totalAmount
  ) {
    this.status = "partial";
  } else if (this.status === "sent" && now > this.dueDate) {
    this.status = "overdue";
  }
};

invoiceSchema.methods.markAsSent = function (email = null) {
  this.status = "sent";
  this.sentAt = new Date();
  if (email) {
    this.sentTo.push({ email, sentAt: new Date() });
  }
  return this.save();
};

invoiceSchema.methods.recordPayment = function (
  amount,
  paymentMethod = "",
  paymentId = null
) {
  this.paymentStatus.amountPaid += amount;
  this.paymentStatus.amountDue = Math.max(
    0,
    this.totalAmount - this.paymentStatus.amountPaid
  );
  this.paymentStatus.lastPaymentDate = new Date();

  if (paymentId) {
    this.payments.push(paymentId);
  }

  if (paymentMethod) {
    this.paymentMethod = paymentMethod;
  }

  if (this.paymentStatus.amountPaid >= this.totalAmount) {
    this.status = "paid";
    this.paidAt = new Date();
  } else if (this.paymentStatus.amountPaid > 0) {
    this.status = "partial";
  }

  return this.save();
};

invoiceSchema.methods.cancel = function (userId, reason = "") {
  this.status = "cancelled";
  this.cancelledAt = new Date();
  this.cancelledBy = userId;
  this.cancellationReason = reason;
  return this.save();
};

invoiceSchema.methods.addReminder = function (type = "reminder") {
  this.remindersSent.push({
    sentAt: new Date(),
    type,
  });
  return this.save();
};

invoiceSchema.methods.canModify = function () {
  return ["draft", "sent"].includes(this.status);
};

invoiceSchema.methods.canDelete = function () {
  return (
    this.status === "draft" ||
    (this.status === "sent" && this.paymentStatus.amountPaid === 0)
  );
};

// ============================================
// STATIC METHODS
// ============================================

invoiceSchema.statics.getOverdue = function (venueId, invoiceType = null) {
  const query = {
    venue: venueId,
    status: { $in: ["sent", "partial"] },
    dueDate: { $lt: new Date() },
  };
  if (invoiceType) {
    query.invoiceType = invoiceType;
  }
  return this.find(query).sort({ dueDate: 1 });
};

invoiceSchema.statics.getDueSoon = function (venueId, days = 7, invoiceType = null) {
  const today = new Date();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);

  const query = {
    venue: venueId,
    status: { $in: ["sent", "partial"] },
    dueDate: { $gte: today, $lte: futureDate },
  };
  if (invoiceType) {
    query.invoiceType = invoiceType;
  }
  return this.find(query).sort({ dueDate: 1 });
};

invoiceSchema.statics.getStats = async function (
  venueId,
  startDate = null,
  endDate = null,
  invoiceType = null
) {
  const matchQuery = { venue: new mongoose.Types.ObjectId(venueId) };

  if (invoiceType) {
    matchQuery.invoiceType = invoiceType;
  }

  if (startDate || endDate) {
    matchQuery.issueDate = {};
    if (startDate) matchQuery.issueDate.$gte = new Date(startDate);
    if (endDate) matchQuery.issueDate.$lte = new Date(endDate);
  }

  const stats = await this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: "$invoiceType",
        totalInvoices: { $sum: 1 },
        totalRevenue: { $sum: "$totalAmount" },
        totalPaid: { $sum: "$paymentStatus.amountPaid" },
        totalDue: { $sum: "$paymentStatus.amountDue" },
        draft: { $sum: { $cond: [{ $eq: ["$status", "draft"] }, 1, 0] } },
        sent: { $sum: { $cond: [{ $eq: ["$status", "sent"] }, 1, 0] } },
        paid: { $sum: { $cond: [{ $eq: ["$status", "paid"] }, 1, 0] } },
        partial: { $sum: { $cond: [{ $eq: ["$status", "partial"] }, 1, 0] } },
        overdue: { $sum: { $cond: [{ $eq: ["$status", "overdue"] }, 1, 0] } },
        cancelled: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } },
      },
    },
  ]);

  return stats;
};

invoiceSchema.set("toJSON", { virtuals: true });
invoiceSchema.set("toObject", { virtuals: true });

export default mongoose.model("Invoice", invoiceSchema);