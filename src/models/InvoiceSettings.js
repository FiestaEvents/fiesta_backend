import mongoose from "mongoose";

// ==========================================
// 1. CONSTANTS (Pure Data)
// ==========================================
const DEFAULTS = {
  branding: {
    colors: {
      primary: "#F18237",
      secondary: "#374151",
      text: "#1F2937",
      background: "#FFFFFF",
    },
    fonts: { size: 10, body: "Helvetica" },
    watermark: { enabled: false, url: "" },
  },
  layout: {
    template: "modern",
    density: "standard",
    borderRadius: 4,
    // The default order of blocks
    sections: [
      { id: "header", label: "En-tête", visible: true, order: 1 },
      { id: "details", label: "Détails (De/À)", visible: true, order: 2 },
      { id: "items", label: "Tableau Articles", visible: true, order: 3 },
      { id: "totals", label: "Totaux", visible: true, order: 4 },
      { id: "footer", label: "Pied de page", visible: true, order: 5 },
    ],
  },
  table: {
    headerColor: "#F18237",
    striped: false,
    rounded: true,
    columns: {
      description: true,
      quantity: true,
      rate: true,
      discount: false,
      tax: false,
      total: true,
    },
  },
  labels: {
    invoiceTitle: "FACTURE",
    from: "De",
    to: "À",
    item: "Description",
    quantity: "Qté",
    rate: "Prix",
    total: "Total",
    paymentInstructions: "Instructions de paiement",
  },
};

// ==========================================
// 2. SCHEMA DEFINITION
// ==========================================
const invoiceSettingsSchema = new mongoose.Schema(
  {
    // =========================================================
    // ARCHITECTURE UPDATE: Replaces venue
    // =========================================================
    // Renamed to businessId to match User/Event/Client models
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      unique: true, // One settings doc per business
    },

    // --- BRANDING ---
    branding: {
      logo: { url: String, width: Number, height: Number },
      colors: {
        primary: { type: String, default: DEFAULTS.branding.colors.primary },
        secondary: { type: String, default: DEFAULTS.branding.colors.secondary },
        text: { type: String, default: DEFAULTS.branding.colors.text },
        background: { type: String, default: DEFAULTS.branding.colors.background },
      },
      fonts: {
        size: { type: Number, default: DEFAULTS.branding.fonts.size },
        body: { type: String, default: DEFAULTS.branding.fonts.body },
      },
      watermark: {
        enabled: { type: Boolean, default: false },
        url: String,
      },
    },

    // --- LAYOUT & SECTIONS (For Drag & Drop) ---
    layout: {
      template: { type: String, default: DEFAULTS.layout.template },
      density: { type: String, enum: ["compact", "standard", "spacious"], default: "standard" },
      borderRadius: { type: Number, default: 4 },
      sections: [
        {
          _id: false, // No ID needed for sub-object
          id: { type: String, required: true }, // 'header', 'items', etc.
          label: String,
          visible: { type: Boolean, default: true },
          order: { type: Number, required: true },
        },
      ],
    },

    // --- TABLE STYLING ---
    table: {
      headerColor: { type: String, default: DEFAULTS.table.headerColor },
      striped: { type: Boolean, default: DEFAULTS.table.striped },
      rounded: { type: Boolean, default: DEFAULTS.table.rounded },
      columns: {
        description: { type: Boolean, default: true },
        quantity: { type: Boolean, default: true },
        rate: { type: Boolean, default: true },
        discount: { type: Boolean, default: false },
        tax: { type: Boolean, default: false },
        total: { type: Boolean, default: true },
      },
    },

    // --- TEXT LABELS ---
    labels: {
      invoiceTitle: { type: String, default: DEFAULTS.labels.invoiceTitle },
      from: { type: String, default: DEFAULTS.labels.from },
      to: { type: String, default: DEFAULTS.labels.to },
      item: { type: String, default: DEFAULTS.labels.item },
      quantity: { type: String, default: DEFAULTS.labels.quantity },
      rate: { type: String, default: DEFAULTS.labels.rate },
      total: { type: String, default: DEFAULTS.labels.total },
      paymentInstructions: { type: String, default: DEFAULTS.labels.paymentInstructions },
    },

    // --- PAYMENT INFO ---
    paymentTerms: {
      bankDetails: String,
      terms: String,
    },
  },
  { timestamps: true }
);

// ==========================================
// 3. METHODS
// ==========================================
invoiceSettingsSchema.statics.getOrCreate = async function (businessId) {
  let settings = await this.findOne({ businessId });

  if (!settings) {
    // Merge defaults
    settings = await this.create({
      businessId,
      branding: DEFAULTS.branding,
      layout: DEFAULTS.layout,
      table: DEFAULTS.table,
      labels: DEFAULTS.labels,
    });
  } else {
    // Ensure sections exist if migrating from old version
    if (!settings.layout.sections || settings.layout.sections.length === 0) {
      settings.layout.sections = DEFAULTS.layout.sections;
      await settings.save();
    }
  }
  return settings;
};

export default mongoose.model("InvoiceSettings", invoiceSettingsSchema);