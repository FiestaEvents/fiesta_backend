import mongoose from "mongoose";

const DEFAULTS = {
  structure: {
    prefix: "CTR",
    separator: "-",
    includeYear: true,
    yearFormat: "YYYY", // 'YYYY' or 'YY'
    sequenceDigits: 4,
    resetSequenceYearly: true
  },
  companyInfo: {
    // Populated from Business profile by default, can be overridden
  },
  financialDefaults: {
    currency: "TND",
    defaultVatRate: 19,
    defaultStampDuty: 1.000,
    paymentTerms: "Due upon receipt"
  }
};

const contractSettingsSchema = new mongoose.Schema(
  {
    // =========================================================
    // ARCHITECTURE UPDATE: Replaces venue
    // =========================================================
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      unique: true,
    },

    // 1. Contract Numbering Structure
    structure: {
      prefix: { type: String, default: DEFAULTS.structure.prefix },
      separator: { type: String, default: DEFAULTS.structure.separator },
      includeYear: { type: Boolean, default: DEFAULTS.structure.includeYear },
      yearFormat: { type: String, enum: ["YYYY", "YY"], default: DEFAULTS.structure.yearFormat },
      sequenceDigits: { type: Number, default: DEFAULTS.structure.sequenceDigits },
      resetSequenceYearly: { type: Boolean, default: DEFAULTS.structure.resetSequenceYearly }
    },

    // 2. Company Info Override (for Contracts specifically)
    companyInfo: {
      displayName: String,
      legalName: String,
      address: String,
      matriculeFiscale: String,
      phone: String,
      email: String,
      website: String
    },

    // 3. Branding (Logo, Colors)
    branding: {
      logo: { url: String },
      colors: {
        primary: { type: String, default: "#F18237" },
        text: { type: String, default: "#1F2937" }
      },
      font: { type: String, default: "Helvetica" }
    },

    // 4. Financial Defaults
    financialDefaults: {
      currency: { type: String, default: DEFAULTS.financialDefaults.currency },
      defaultVatRate: { type: Number, default: DEFAULTS.financialDefaults.defaultVatRate },
      defaultStampDuty: { type: Number, default: DEFAULTS.financialDefaults.defaultStampDuty },
      paymentTerms: { type: String, default: DEFAULTS.financialDefaults.paymentTerms }
    },

    // 5. Legal & Content Defaults
    defaultCancellationPolicy: String,
    defaultSpecialConditions: String,
    
    // Labels (for i18n or customization)
    labels: {
      contractTitle: { type: String, default: "CONTRAT DE PRESTATION" },
      partnerContractTitle: { type: String, default: "ACCORD DE PARTENARIAT" },
      clientLabel: { type: String, default: "Le Client" },
      partnerLabel: { type: String, default: "Le Partenaire" },
      serviceProvider: { type: String, default: "La Société" }, // "The Company"
      signaturesTitle: { type: String, default: "SIGNATURES" }
    },

    // Email Templates
    emailTemplates: {
      sendContract: {
        subject: { type: String, default: "Votre contrat est prêt" },
        body: { type: String, default: "Veuillez trouver ci-joint votre contrat." }
      }
    }
  },
  {
    timestamps: true,
  }
);

// Helper to get or create settings
contractSettingsSchema.statics.getOrCreate = async function (businessId) {
  let settings = await this.findOne({ business: businessId });

  if (!settings) {
    settings = await this.create({
      business: businessId,
      structure: DEFAULTS.structure,
      financialDefaults: DEFAULTS.financialDefaults
    });
  }
  return settings;
};

export default mongoose.models.ContractSettings || mongoose.model("ContractSettings", contractSettingsSchema);