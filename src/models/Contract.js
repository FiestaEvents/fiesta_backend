import mongoose from "mongoose";

// The specific list you requested
const PARTNER_CATEGORIES = [
  "driver", "bakery", "catering", "decoration", "photography", 
  "music", "security", "cleaning", "audio_visual", "floral", 
  "entertainment", "hairstyling", "other"
];

const contractSchema = new mongoose.Schema(
  {
    contractNumber: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true, trim: true },
    
    // BUSINESS LOGIC: Differentiates Income (Client) vs Expense (Partner)
    contractType: { 
      type: String, 
      enum: ["client", "partner"], 
      default: "client",
      required: true 
    },
    
    status: {
      type: String,
      enum: ["draft", "sent", "viewed", "signed", "cancelled", "expired"],
      default: "draft",
    },

    venue: { type: mongoose.Schema.Types.ObjectId, ref: "Venue", required: true },
    event: { type: mongoose.Schema.Types.ObjectId, ref: "Event" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    party: {
      type: { type: String, enum: ["individual", "company"], default: "individual" },
      name: { type: String, required: true },
      identifier: { type: String, required: true }, // MF or CIN
      representative: String,
      address: { type: String, required: true },
      phone: String,
      email: String,
      
      // ✅ NEW: Strict Category List
      category: { 
        type: String, 
        enum: PARTNER_CATEGORIES,
        default: "other"
      },
      // ✅ NEW: Price structure for partners
      priceType: { type: String, enum: ["fixed", "hourly"], default: "fixed" }
    },

    logistics: {
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
      checkInTime: String,
      checkOutTime: String,
    },

    services: [{
      description: String,
      quantity: { type: Number, default: 1 },
      rate: { type: Number, default: 0 }, // If Client: Selling Price. If Partner: Cost.
      amount: Number,
    }],

    financials: {
      currency: { type: String, default: "TND" },
      amountHT: { type: Number, required: true }, 
      
      // Client specific
      vatRate: { type: Number, default: 19 },
      taxAmount: { type: Number, default: 0 },
      stampDuty: { type: Number, default: 1.000 },
      
      // Partner specific (Withholding tax / Retenue à la source)
      withholdingTaxRate: { type: Number, default: 0 }, 
      withholdingAmount: { type: Number, default: 0 },

      totalTTC: { type: Number, required: true }, // Final amount to Pay/Receive
    },

    paymentTerms: {
      depositAmount: { type: Number, default: 0 },
      securityDeposit: { type: Number, default: 0 },
      dueDate: Date,
    },

    legal: {
      jurisdiction: String,
      specialConditions: String,
    },
    
    signatures: {
      venueSignedAt: Date,
      clientSignedAt: Date,
      clientSignerIp: String,
      digitalSignatureToken: String,
    }
  },
  { timestamps: true }
);

export default mongoose.model("Contract", contractSchema);