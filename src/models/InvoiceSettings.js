import mongoose from "mongoose";

const invoiceSettingsSchema = new mongoose.Schema(
  {
    venue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Venue",
      required: true,
      unique: true,
    },
    branding: {
      logo: { url: String, width: Number, height: Number },
      colors: {
        primary: { type: String, default: "#F18237" },
        secondary: { type: String, default: "#374151" },
        text: { type: String, default: "#1F2937" },
        background: { type: String, default: "#FFFFFF" },
      },
      fonts: { size: { type: Number, default: 10 } },
      watermark: { enabled: Boolean, url: String },
    },
    layout: {
      template: { type: String, default: "modern" }, // modern, classic, minimal
      density: { type: String, default: "standard" }, // compact, standard, spacious
      borderRadius: { type: Number, default: 4 },
      sections: [
        { id: String, label: String, visible: Boolean, order: Number },
      ],
    },
    table: {
      headerColor: String,
      striped: { type: Boolean, default: false },
      rounded: { type: Boolean, default: true },
      columns: {
        description: { type: Boolean, default: true },
        quantity: { type: Boolean, default: true },
        rate: { type: Boolean, default: true },
        discount: { type: Boolean, default: false },
        tax: { type: Boolean, default: false },
        total: { type: Boolean, default: true },
      },
    },
    labels: {
      invoiceTitle: { type: String, default: "INVOICE" },
      from: { type: String, default: "From" },
      to: { type: String, default: "Bill To" },
      item: { type: String, default: "Description" },
      quantity: { type: String, default: "Qty" },
      rate: { type: String, default: "Price" },
      total: { type: String, default: "Amount" },
    },
    paymentTerms: {
      bankDetails: String,
    },
  },
  { timestamps: true }
);

// Helper to find or create settings for a venue
invoiceSettingsSchema.statics.getOrCreate = async function (venueId) {
  let settings = await this.findOne({ venue: venueId });
  if (!settings) {
    settings = await this.create({
      venue: venueId,
      "layout.sections": [
        { id: "header", label: "Header", visible: true, order: 1 },
        { id: "details", label: "Details", visible: true, order: 2 },
        { id: "items", label: "Items", visible: true, order: 3 },
        { id: "totals", label: "Totals", visible: true, order: 4 },
        { id: "footer", label: "Footer", visible: true, order: 5 },
      ],
    });
  }
  return settings;
};

export default mongoose.model("InvoiceSettings", invoiceSettingsSchema);