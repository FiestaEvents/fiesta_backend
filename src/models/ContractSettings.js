// src/models/ContractSettings.js
const mongoose = require('mongoose');

// =========================================================
// 1. DEFAULT SETTINGS CONSTANTS
// =========================================================
const DEFAULT_SETTINGS = {
  branding: {
    colors: {
      primary: "#F18237",
      secondary: "#374151",
      accent: "#3B82F6",
      text: "#1F2937",
      background: "#FFFFFF",
    },
    fonts: {
      heading: "Helvetica-Bold",
      body: "Helvetica",
      size: 11,
    },
  },
  layout: {
    template: "professional",
    paperSize: "A4",
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
    headerHeight: 80,
    footerHeight: 60,
    showPageNumbers: true,
    showDate: true,
    blockOrder: ["header", "parties", "scope", "financials", "clauses", "signatures", "footer"],
  },
  financialDefaults: {
    currency: "TND",
    defaultVatRate: 19,
    defaultStampDuty: 1.000,
    depositPercentage: 30,
    depositRequired: true,
    securityDepositAmount: 1000,
    paymentMethods: ["Virement", "Chèque", "Espèces"],
    lateFeePercentage: 0,
  },
  labels: {
    contractTitle: "CONTRAT DE PRESTATION",
    partiesTitle: "ENTRE LES SOUSSIGNÉS",
    serviceProvider: "Le Prestataire", // Generic enough for Venue, Driver, or Photographer
    clientLabel: "Le Client",
    partnerLabel: "Le Partenaire",
    servicesTitle: "OBJET DU CONTRAT",
    paymentTitle: "MODALITÉS DE PAIEMENT",
    signaturesTitle: "SIGNATURES",
    dateLabel: "Fait à Tunis, le",
    signatureLabel: "Lu et approuvé",
  },
  defaultSections: [
    {
      id: "scope",
      title: "Article 1 : Objet du Contrat",
      content: "Le présent contrat a pour objet la fourniture de services pour l'événement décrit ci-dessus.",
      type: "scope",
      order: 1,
      isRequired: true,
      isDefault: true,
    },
    {
      id: "payment",
      title: "Article 2 : Modalités de Paiement",
      content: "Le Client s'engage à verser une avance de 30% à la signature. Le solde doit être réglé impérativement avant la date de l'événement.",
      type: "payment",
      order: 2,
      isRequired: true,
      isDefault: true,
    },
    {
      id: "cancellation",
      title: "Article 3 : Annulation",
      content: "Toute annulation doit être notifiée par écrit. L'acompte versé reste acquis au Prestataire à titre d'indemnité forfaitaire si l'annulation intervient moins de 30 jours avant l'événement.",
      type: "cancellation",
      order: 3,
      isRequired: true,
      isDefault: true,
    },
    {
      id: "liability",
      title: "Article 4 : Responsabilité",
      content: "Le Client est responsable de tout dommage causé aux équipements ou au personnel par ses invités.",
      type: "liability",
      order: 4,
      isRequired: true,
      isDefault: true,
    },
    {
      id: "jurisdiction",
      title: "Article 5 : Juridiction",
      content: "En cas de litige, et faute d'accord amiable, les tribunaux du siège social du Prestataire seront seuls compétents.",
      type: "jurisdiction",
      order: 5,
      isRequired: true,
      isDefault: true,
    },
  ],
  cancellationPolicy: {
    enabled: true,
    tiers: [
      { daysBeforeEvent: 90, penaltyPercentage: 0, description: "Annulation gratuite" },
      { daysBeforeEvent: 30, penaltyPercentage: 50, description: "50% de pénalité" },
      { daysBeforeEvent: 7, penaltyPercentage: 100, description: "100% de pénalité" },
    ],
  },
  structure: {
    prefix: "CTR",
    separator: "-",
    includeYear: true,
    yearFormat: "YYYY",
    sequenceDigits: 4,
    resetSequenceYearly: true,
  },
  emailTemplates: {
    sendContract: {
      subject: "Contrat à signer - {{eventTitle}}",
    },
    reminder: {
      subject: "Rappel : Contrat en attente",
    },
    signed: {
      subject: "Contrat signé - {{contractNumber}}",
    },
  },
};

// =========================================================
// 2. MONGOOSE SCHEMA DEFINITION
// =========================================================
const contractSettingsSchema = new mongoose.Schema(
  {
    // ARCHITECTURE UPDATE: Replaces Venue with Business
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      unique: true,
    },

    // 1. BRANDING
    branding: {
      logo: { url: String, width: Number, height: Number },
      colors: {
        primary: { type: String, default: DEFAULT_SETTINGS.branding.colors.primary },
        secondary: { type: String, default: DEFAULT_SETTINGS.branding.colors.secondary },
        accent: { type: String, default: DEFAULT_SETTINGS.branding.colors.accent },
        text: { type: String, default: DEFAULT_SETTINGS.branding.colors.text },
        background: { type: String, default: DEFAULT_SETTINGS.branding.colors.background },
      },
      fonts: {
        heading: { type: String, default: DEFAULT_SETTINGS.branding.fonts.heading },
        body: { type: String, default: DEFAULT_SETTINGS.branding.fonts.body },
        size: { type: Number, default: DEFAULT_SETTINGS.branding.fonts.size },
      },
      watermark: { enabled: Boolean, text: String, opacity: Number },
    },

    // 2. LAYOUT
    layout: {
      template: { type: String, default: DEFAULT_SETTINGS.layout.template },
      paperSize: { type: String, default: DEFAULT_SETTINGS.layout.paperSize },
      margins: {
        top: { type: Number, default: DEFAULT_SETTINGS.layout.margins.top },
        bottom: { type: Number, default: DEFAULT_SETTINGS.layout.margins.bottom },
        left: { type: Number, default: DEFAULT_SETTINGS.layout.margins.left },
        right: { type: Number, default: DEFAULT_SETTINGS.layout.margins.right },
      },
      headerHeight: { type: Number, default: DEFAULT_SETTINGS.layout.headerHeight },
      footerHeight: { type: Number, default: DEFAULT_SETTINGS.layout.footerHeight },
      showPageNumbers: { type: Boolean, default: DEFAULT_SETTINGS.layout.showPageNumbers },
      showDate: { type: Boolean, default: DEFAULT_SETTINGS.layout.showDate },
      blockOrder: { 
        type: [String], 
        default: DEFAULT_SETTINGS.layout.blockOrder 
      },
    },

    // 3. COMPANY INFO
    companyInfo: {
      legalName: { type: String, required: true },
      displayName: String,
      matriculeFiscale: { type: String, required: true }, // Tax ID
      address: { type: String, required: true },
      phone: String,
      email: String,
      website: String,
      rib: String,
      bankName: String,
      legalRepresentative: String,
    },

    // 4. FINANCIAL DEFAULTS
    financialDefaults: {
      currency: { type: String, default: DEFAULT_SETTINGS.financialDefaults.currency },
      defaultVatRate: { type: Number, default: DEFAULT_SETTINGS.financialDefaults.defaultVatRate },
      defaultStampDuty: { type: Number, default: DEFAULT_SETTINGS.financialDefaults.defaultStampDuty },
      depositPercentage: { type: Number, default: DEFAULT_SETTINGS.financialDefaults.depositPercentage },
      depositRequired: { type: Boolean, default: DEFAULT_SETTINGS.financialDefaults.depositRequired },
      securityDepositAmount: { type: Number, default: DEFAULT_SETTINGS.financialDefaults.securityDepositAmount },
      paymentMethods: {
        type: [String],
        default: DEFAULT_SETTINGS.financialDefaults.paymentMethods,
      },
      lateFeePercentage: { type: Number, default: DEFAULT_SETTINGS.financialDefaults.lateFeePercentage },
    },

    // 5. SECTIONS
    defaultSections: [
      {
        id: String,
        title: String,
        content: String,
        type: {
          type: String,
          enum: ["terms", "scope", "payment", "cancellation", "liability", "jurisdiction", "custom"],
        },
        order: Number,
        isRequired: Boolean,
        isDefault: { type: Boolean, default: true },
      },
    ],

    // 6. LABELS
    labels: {
      contractTitle: { type: String, default: DEFAULT_SETTINGS.labels.contractTitle },
      partiesTitle: { type: String, default: DEFAULT_SETTINGS.labels.partiesTitle },
      serviceProvider: { type: String, default: DEFAULT_SETTINGS.labels.serviceProvider },
      clientLabel: { type: String, default: DEFAULT_SETTINGS.labels.clientLabel },
      partnerLabel: { type: String, default: DEFAULT_SETTINGS.labels.partnerLabel },
      servicesTitle: { type: String, default: DEFAULT_SETTINGS.labels.servicesTitle },
      paymentTitle: { type: String, default: DEFAULT_SETTINGS.labels.paymentTitle },
      signaturesTitle: { type: String, default: DEFAULT_SETTINGS.labels.signaturesTitle },
      dateLabel: { type: String, default: DEFAULT_SETTINGS.labels.dateLabel },
      signatureLabel: { type: String, default: DEFAULT_SETTINGS.labels.signatureLabel },
    },

    // 7. CANCELLATION
    defaultCancellationPolicy: {
      enabled: { type: Boolean, default: DEFAULT_SETTINGS.cancellationPolicy.enabled },
      tiers: [
        {
          daysBeforeEvent: Number,
          penaltyPercentage: Number,
          description: String,
        },
      ],
    },

    signatureSettings: {
      requireBothParties: { type: Boolean, default: true },
      allowElectronicSignature: { type: Boolean, default: true },
      signatureExpiryDays: { type: Number, default: 7 },
      autoArchiveAfter: { type: Number, default: 365 },
    },

    emailTemplates: {
      sendContract: {
        subject: { type: String, default: DEFAULT_SETTINGS.emailTemplates.sendContract.subject },
        body: String,
      },
      reminder: {
        subject: { type: String, default: DEFAULT_SETTINGS.emailTemplates.reminder.subject },
        body: String,
      },
      signed: {
        subject: { type: String, default: DEFAULT_SETTINGS.emailTemplates.signed.subject },
        body: String,
      },
    },

    // 8. STRUCTURE
    structure: {
      prefix: { type: String, default: DEFAULT_SETTINGS.structure.prefix },
      separator: { type: String, default: DEFAULT_SETTINGS.structure.separator },
      includeYear: { type: Boolean, default: DEFAULT_SETTINGS.structure.includeYear },
      yearFormat: { type: String, enum: ["YYYY", "YY"], default: DEFAULT_SETTINGS.structure.yearFormat },
      sequenceDigits: { type: Number, default: DEFAULT_SETTINGS.structure.sequenceDigits },
      resetSequenceYearly: { type: Boolean, default: DEFAULT_SETTINGS.structure.resetSequenceYearly },
    },
  },
  { timestamps: true }
);

// =========================================================
// STATIC: Get Or Create Defaults
// =========================================================
contractSettingsSchema.statics.getOrCreate = async function (businessId) {
  let settings = await this.findOne({ business: businessId });

  if (!settings) {
    // UPDATED: Fetch from Business model instead of Venue
    const Business = mongoose.model("Business");
    const business = await Business.findById(businessId);

    if (!business) {
      throw new Error("Business not found when creating default contract settings");
    }

    // Format generic address string from Business address object
    const formatAddress = (addr) => {
      if (!addr) return "Adresse du siège";
      const parts = [addr.street, addr.city, addr.zipCode, addr.state].filter(Boolean);
      return parts.length > 0 ? parts.join(", ") : "Adresse du siège";
    };

    settings = await this.create({
      business: businessId,
      companyInfo: {
        legalName: business.name || "Votre Raison Sociale",
        displayName: business.name || "Nom Commercial",
        matriculeFiscale: "0000000/A/M/000",
        address: formatAddress(business.address),
        phone: business.contact?.phone || "",
        email: business.contact?.email || "",
        rib: "",
        legalRepresentative: "",
      },
      branding: DEFAULT_SETTINGS.branding,
      layout: DEFAULT_SETTINGS.layout,
      labels: DEFAULT_SETTINGS.labels,
      defaultSections: DEFAULT_SETTINGS.defaultSections,
      defaultCancellationPolicy: DEFAULT_SETTINGS.cancellationPolicy,
      structure: DEFAULT_SETTINGS.structure,
    });
  }
  return settings;
};

module.exports = mongoose.model("ContractSettings", contractSettingsSchema);