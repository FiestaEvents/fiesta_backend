import mongoose from "mongoose";

const contractSettingsSchema = new mongoose.Schema(
  {
    venue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Venue",
      required: true,
      unique: true,
    },

    // =========================================================
    // 1. BRANDING & STYLING
    // =========================================================
    branding: {
      logo: { url: String, width: Number, height: Number },
      colors: {
        primary: { type: String, default: "#F18237" }, // Brand Orange
        secondary: { type: String, default: "#374151" }, // Slate 700
        accent: { type: String, default: "#3B82F6" }, // Blue 500
        text: { type: String, default: "#1F2937" }, // Gray 800
        background: { type: String, default: "#FFFFFF" },
      },
      fonts: {
        heading: { type: String, default: "Helvetica-Bold" },
        body: { type: String, default: "Helvetica" },
        size: { type: Number, default: 11 }, // Standard PT size for contracts
      },
      watermark: { enabled: Boolean, text: String, opacity: Number },
    },

    // =========================================================
    // 2. PDF LAYOUT SETTINGS
    // =========================================================
    layout: {
      template: { type: String, default: "professional" }, // professional, modern, legal
      paperSize: { type: String, default: "A4" },
      margins: {
        top: { type: Number, default: 50 },
        bottom: { type: Number, default: 50 },
        left: { type: Number, default: 50 },
        right: { type: Number, default: 50 },
      },
      headerHeight: { type: Number, default: 80 },
      footerHeight: { type: Number, default: 60 },
      showPageNumbers: { type: Boolean, default: true },
      showDate: { type: Boolean, default: true },
    },

    // =========================================================
    // 3. VENUE COMPANY INFO (The "First Party")
    // =========================================================
    companyInfo: {
      legalName: { type: String, required: true }, // Raison Sociale
      displayName: String, // Enseigne Commerciale
      matriculeFiscale: { type: String, required: true }, // MF: 1234567/A/M/000
      address: { type: String, required: true }, // Siège Social
      phone: String,
      email: String,
      website: String,
      rib: String, // Relevé d'Identité Bancaire (20 digits)
      bankName: String,
      legalRepresentative: String, // Gérant
    },

    // =========================================================
    // 4. DEFAULT FINANCIAL TERMS (Tunisian System)
    // =========================================================
    financialDefaults: {
      currency: { type: String, default: "TND" },
      defaultVatRate: { type: Number, default: 19 }, // TVA Standard
      defaultStampDuty: { type: Number, default: 1.000 }, // Timbre Fiscal
      depositPercentage: { type: Number, default: 30 }, // Avance Standard
      depositRequired: { type: Boolean, default: true },
      securityDepositAmount: { type: Number, default: 1000 }, // Caution Standard
      paymentMethods: {
        type: [String],
        default: ["Virement", "Chèque", "Espèces"]
      },
      lateFeePercentage: { type: Number, default: 0 },
    },

    // =========================================================
    // 5. DEFAULT CLAUSES & SECTIONS
    // =========================================================
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

    // =========================================================
    // 6. LABELS (Localization - FR/AR/EN)
    // =========================================================
    labels: {
      contractTitle: { type: String, default: "CONTRAT DE PRESTATION DE SERVICE" },
      partiesTitle: { type: String, default: "ENTRE LES SOUSSIGNÉS" },
      serviceProvider: { type: String, default: "Le Prestataire" },
      clientLabel: { type: String, default: "Le Client" },
      partnerLabel: { type: String, default: "Le Partenaire" },
      servicesTitle: { type: String, default: "OBJET DU CONTRAT" },
      paymentTitle: { type: String, default: "MODALITÉS DE PAIEMENT" },
      signaturesTitle: { type: String, default: "SIGNATURES" },
      dateLabel: { type: String, default: "Fait à Tunis, le" },
      signatureLabel: { type: String, default: "Lu et approuvé" },
    },

    // =========================================================
    // 7. CANCELLATION POLICY DEFAULTS
    // =========================================================
    defaultCancellationPolicy: {
      enabled: { type: Boolean, default: true },
      tiers: [
        {
          daysBeforeEvent: Number,
          penaltyPercentage: Number, // Changed from refund to penalty for clarity in backend logic
          description: String,
        },
      ],
    },

    // =========================================================
    // 8. SIGNATURE & WORKFLOW
    // =========================================================
    signatureSettings: {
      requireBothParties: { type: Boolean, default: true },
      allowElectronicSignature: { type: Boolean, default: true },
      signatureExpiryDays: { type: Number, default: 7 },
      autoArchiveAfter: { type: Number, default: 365 }, // Days after event
    },

    // =========================================================
    // 9. EMAIL TEMPLATES
    // =========================================================
    emailTemplates: {
      sendContract: {
        subject: { type: String, default: "Contrat à signer - {{eventTitle}}" },
        body: String,
      },
      reminder: {
        subject: { type: String, default: "Rappel : Contrat en attente de signature" },
        body: String,
      },
      signed: {
        subject: { type: String, default: "Contrat signé - {{contractNumber}}" },
        body: String,
      },
    },
  },
  { timestamps: true }
);

// =========================================================
// STATIC METHOD: Get Or Create Defaults
// =========================================================
contractSettingsSchema.statics.getOrCreate = async function (venueId) {
  let settings = await this.findOne({ venue: venueId });
  
  if (!settings) {
    // Fetch venue details to pre-fill company info if possible
    const Venue = mongoose.model("Venue");
    const venue = await Venue.findById(venueId);

    settings = await this.create({
      venue: venueId,
      
      companyInfo: {
        legalName: venue?.name || "Votre Raison Sociale",
        displayName: venue?.name || "Nom Commercial",
        matriculeFiscale: "0000000/A/M/000",
        address: venue?.address || "Adresse du siège",
        phone: venue?.phone || "",
        email: venue?.email || "",
        rib: "",
        legalRepresentative: "",
      },

      defaultSections: [
        {
          id: "scope",
          title: "Article 1 : Objet du Contrat",
          content: "Le présent contrat a pour objet la location de la salle et/ou la fourniture de services pour l'événement décrit ci-dessus.",
          type: "scope",
          order: 1,
          isRequired: true,
          isDefault: true,
        },
        {
          id: "payment",
          title: "Article 2 : Modalités de Paiement",
          content: "Le Client s'engage à verser une avance de {{depositPercentage}}% à la signature. Le solde doit être réglé impérativement avant la date de l'événement.",
          type: "payment",
          order: 2,
          isRequired: true,
          isDefault: true,
        },
        {
          id: "cancellation",
          title: "Article 3 : Annulation",
          content: "Toute annulation doit être notifiée par écrit. L'acompte versé reste acquis au Prestataire à titre d'indemnité forfaitaire.",
          type: "cancellation",
          order: 3,
          isRequired: true,
          isDefault: true,
        },
        {
          id: "liability",
          title: "Article 4 : Responsabilité & Assurance",
          content: "Le Client est responsable de tout dommage causé aux locaux ou équipements par ses invités. Une caution de {{securityDepositAmount}} TND est requise.",
          type: "liability",
          order: 4,
          isRequired: true,
          isDefault: true,
        },
        {
          id: "jurisdiction",
          title: "Article 5 : Juridiction Compétente",
          content: "En cas de litige, et faute d'accord amiable, les tribunaux de Tunis seront seuls compétents.",
          type: "jurisdiction",
          order: 5,
          isRequired: true,
          isDefault: true,
        },
      ],

      defaultCancellationPolicy: {
        enabled: true,
        tiers: [
          { daysBeforeEvent: 90, penaltyPercentage: 0, description: "Annulation gratuite" },
          { daysBeforeEvent: 30, penaltyPercentage: 50, description: "50% de pénalité" },
          { daysBeforeEvent: 7, penaltyPercentage: 100, description: "100% de pénalité (Aucun remboursement)" },
        ],
      },
    });
  }
  return settings;
};

export default mongoose.model("ContractSettings", contractSettingsSchema);