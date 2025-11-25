import mongoose from "mongoose";

const contractSchema = new mongoose.Schema(
  {
    // =========================================================
    // 1. METADATA & STATUS
    // =========================================================
    contractNumber: {
      type: String,
      required: true,
      unique: true,
      index: true, // "CTR-2025-001"
    },
    title: {
      type: String,
      required: true,
      trim: true, // e.g., "Contrat de Location - Mariage X"
    },
    contractType: {
      type: String,
      enum: ["client", "partner"],
      default: "client",
    },
    status: {
      type: String,
      enum: ["draft", "sent", "viewed", "signed", "cancelled", "expired"],
      default: "draft",
    },
    version: {
      type: Number,
      default: 1, // For tracking amendments
    },

    // =========================================================
    // 2. RELATIONSHIPS
    // =========================================================
    venue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Venue",
      required: true,
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      // Not required, as a contract might be drafted before an event is fully created
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // =========================================================
    // 3. PARTY IDENTIFICATION (The Second Party)
    // =========================================================
    party: {
      type: {
        type: String,
        enum: ["individual", "company"],
        default: "individual",
        required: true,
      },
      name: {
        type: String,
        required: true, // Full Name or Company Name (Raison Sociale)
      },
      identifier: {
        type: String,
        required: true, // CIN (8 digits) or Matricule Fiscale (e.g., 1234567/A/M/000)
      },
      representative: {
        type: String, // "Gérant" or Legal Rep (Required if type is 'company')
      },
      address: {
        type: String,
        required: true, // Siège Social or Domicile
      },
      phone: String,
      email: {
        type: String,
        lowercase: true,
        trim: true,
      },
    },

    // =========================================================
    // 4. LOGISTICS (Dates & Times)
    // =========================================================
    logistics: {
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
      checkInTime: { type: String, default: "10:00" }, // Access for setup
      checkOutTime: { type: String, default: "00:00" }, // Mandatory vacating time
    },

    // =========================================================
    // 5. FINANCIALS (Tunisian Tax System)
    // =========================================================
    financials: {
      currency: { type: String, default: "TND" },
      amountHT: { 
        type: Number, 
        required: true, 
        min: 0 
      }, // Base Amount
      vatRate: { 
        type: Number, 
        default: 19, // Standard 19%
        min: 0 
      },
      taxAmount: { 
        type: Number, 
        default: 0 
      }, // Calculated VAT value
      stampDuty: { 
        type: Number, 
        default: 1.000 
      }, // Timbre Fiscal (usually 1.000 DT)
      totalTTC: { 
        type: Number, 
        required: true 
      }, // Total All Taxes Included
    },

    // =========================================================
    // 6. PAYMENT TERMS
    // =========================================================
    paymentTerms: {
      depositAmount: { type: Number, default: 0 }, // "Avance" to block date
      securityDeposit: { type: Number, default: 0 }, // "Caution" check
      dueDate: Date, // Deadline for full payment
      isWithholdingTaxApplicable: { type: Boolean, default: false }, // "Retenue à la source" (for B2B)
    },

    // =========================================================
    // 7. LEGAL CLAUSES
    // =========================================================
    legal: {
      cancellationPolicy: {
        type: String,
        enum: ["strict", "standard", "flexible"],
        default: "standard",
      },
      jurisdiction: {
        type: String,
        default: "Tribunal de Tunis", // Default competent court
      },
      specialConditions: {
        type: String, // Free text for specific agreements (noise, kitchen use, etc.)
      },
    },

    // =========================================================
    // 8. SIGNATURES & HISTORY
    // =========================================================
    signatures: {
      venueSignedAt: Date,
      venueSignerIp: String,
      clientSignedAt: Date,
      clientSignerIp: String,
      digitalSignatureToken: String, // For verification
    },
    
    // If you want to allow file uploads (scanned contracts)
    attachments: [
      {
        name: String,
        url: String,
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

// ---------------------------------------------------------
// INDEXES (For faster searching)
// ---------------------------------------------------------
contractSchema.index({ "party.name": "text", "party.identifier": "text", title: "text" });
contractSchema.index({ status: 1 });
contractSchema.index({ "logistics.startDate": 1 });

export default mongoose.model("Contract", contractSchema);