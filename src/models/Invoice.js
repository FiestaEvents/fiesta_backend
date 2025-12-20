import mongoose from "mongoose";

const invoiceSchema = new mongoose.Schema(
  {
    venue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Venue",
      required: true,
      index: true,
    },
    invoiceNumber: {
      type: String,
      unique: true,
    },
    invoiceType: {
      type: String,
      enum: ["client", "partner"],
      default: "client",
    },
    status: {
      type: String,
      enum: ["draft", "sent", "paid", "partial", "overdue", "cancelled"],
      default: "draft",
      index: true,
    },
    // Relationships
    client: { type: mongoose.Schema.Types.ObjectId, ref: "Client" },
    partner: { type: mongoose.Schema.Types.ObjectId, ref: "Partner" },
    event: { type: mongoose.Schema.Types.ObjectId, ref: "Event" },
    
    // Snapshot Data (In case Client/Partner is deleted later)
    recipientName: String,
    recipientEmail: String,
    recipientPhone: String,
    recipientAddress: String,
    recipientCompany: String,

    // Dates
    issueDate: { type: Date, default: Date.now },
    dueDate: { type: Date, required: true },
    
    // Financials
    currency: { type: String, default: "TND" },
    items: [
      {
        description: String,
        quantity: { type: Number, default: 1 },
        rate: { type: Number, default: 0 },
        amount: { type: Number, default: 0 },
      },
    ],
    subtotal: { type: Number, default: 0 },
    taxRate: { type: Number, default: 0 }, // Percentage
    taxAmount: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    
    // Payment Tracking
    paymentStatus: {
      amountPaid: { type: Number, default: 0 },
      amountDue: { type: Number, default: 0 },
      lastPaymentDate: Date,
    },
    
    // Text Fields
    notes: String,
    terms: String,
    
    // Meta
    isArchived: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    sentAt: Date,
  },
  { timestamps: true }
);

// Auto-generate Invoice Number (INV-YY-0001)
invoiceSchema.pre("save", async function (next) {
  if (this.isNew && !this.invoiceNumber) {
    const count = await this.constructor.countDocuments({ venue: this.venue });
    const year = new Date().getFullYear().toString().slice(-2);
    const prefix = this.invoiceType === 'client' ? 'INV' : 'BILL';
    this.invoiceNumber = `${prefix}-${year}-${(count + 1).toString().padStart(4, "0")}`;
  }
  next();
});

export default mongoose.model("Invoice", invoiceSchema);