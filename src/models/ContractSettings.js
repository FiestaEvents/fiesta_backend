import mongoose from "mongoose";

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
    serviceProvider: "Le Prestataire",
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
};

// =========================================================
// 2. MONGOOSE SCHEMA DEFINITION
// =========================================================

// Define Sub-Schema explicitly to avoid "type" keyword conflict
const SectionSchema = new mongoose.Schema({
  id: { type: String },
  title: { type: String },
  content: { type: String },
  // ✅ FIX: Use object definition to use 'type' as a field name
  type: { type: String }, 
  order: { type: Number },
  isRequired: { type: Boolean },
  isDefault: { type: Boolean }
}, { _id: false });

const contractSettingsSchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      unique: true, 
    },

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

    layout: {
      template: { type: String, default: DEFAULT_SETTINGS.layout.template },
      paperSize: { type: String, default: DEFAULT_SETTINGS.layout.paperSize },
      margins: {
        top: { type: Number, default: DEFAULT_SETTINGS.layout.margins.top },
        bottom: { type: Number, default: DEFAULT_SETTINGS.layout.margins.bottom },
        left: { type: Number, default: DEFAULT_SETTINGS.layout.margins.left },
        right: { type: Number, default: DEFAULT_SETTINGS.layout.margins.right },
      },
      blockOrder: { 
        type: [String], 
        default: DEFAULT_SETTINGS.layout.blockOrder 
      },
    },

    companyInfo: {
      legalName: { type: String, required: true },
      displayName: String,
      matriculeFiscale: { type: String, required: true },
      address: { type: String, required: true },
      phone: String,
      email: String,
      rib: String,
    },

    financialDefaults: {
      currency: { type: String, default: DEFAULT_SETTINGS.financialDefaults.currency },
      defaultVatRate: { type: Number, default: DEFAULT_SETTINGS.financialDefaults.defaultVatRate },
      defaultStampDuty: { type: Number, default: DEFAULT_SETTINGS.financialDefaults.defaultStampDuty },
      depositPercentage: { type: Number, default: DEFAULT_SETTINGS.financialDefaults.depositPercentage },
      paymentMethods: { type: [String], default: DEFAULT_SETTINGS.financialDefaults.paymentMethods },
    },

    // ✅ FIX: Use the sub-schema here
    defaultSections: [SectionSchema],

    labels: { type: Object, default: DEFAULT_SETTINGS.labels },
    defaultCancellationPolicy: { type: Object, default: DEFAULT_SETTINGS.cancellationPolicy },
    structure: { type: Object, default: DEFAULT_SETTINGS.structure },
  },
  { timestamps: true }
);

// ==========================================
// 3. METHODS
// ==========================================
contractSettingsSchema.statics.getOrCreate = async function (businessId) {
  let settings = await this.findOne({ business: businessId });

  if (!settings) {
    const Business = mongoose.model("Business");
    const business = await Business.findById(businessId);

    if (!business) {
      // In seed scripts, business might be created but not fully committed if parallel?
      // But usually this means ID is wrong.
      // For seed safety, we can skip fetch if name/address provided in args, 
      // but here we just rely on DB.
      console.warn(`ContractSettings: Business ${businessId} not found, using defaults.`);
    }

    const formatAddress = (addr) => {
      if (!addr) return "Adresse du siège";
      if (typeof addr === 'string') return addr;
      const parts = [addr.street, addr.city, addr.zipCode, addr.state].filter(Boolean);
      return parts.length > 0 ? parts.join(", ") : "Adresse du siège";
    };

    settings = await this.create({
      business: businessId, 
      companyInfo: {
        legalName: business?.name || "Votre Raison Sociale",
        displayName: business?.name || "Nom Commercial",
        matriculeFiscale: "0000000/A/M/000",
        address: business ? formatAddress(business.address) : "Adresse",
        phone: business?.contact?.phone || "",
        email: business?.contact?.email || "",
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

export default mongoose.model("ContractSettings", contractSettingsSchema);