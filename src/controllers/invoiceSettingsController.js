// src/controllers/invoiceSettingsController.js
const InvoiceSettings = require("../models/InvoiceSettings");

exports.getInvoiceSettings = async (req, res) => {
  try {
    // Uses the static method refactored in the Model to get settings for this Business
    const settings = await InvoiceSettings.getOrCreate(req.business._id);
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateInvoiceSettings = async (req, res) => {
  try {
    // Update using 'business' field instead of 'venue'
    const settings = await InvoiceSettings.findOneAndUpdate(
      { business: req.business._id },
      req.body,
      { new: true, upsert: true }
    );
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Placeholder for preview logic (e.g., generating a temporary PDF buffer without saving)
exports.previewInvoice = async (req, res) => {
  res.json({ success: true, message: "Preview generated" });
};

// Placeholder for applying pre-defined templates
exports.applyTemplate = async (req, res) => {
  try {
    const { templateId } = req.body;
    // Logic to fetch template config and apply to settings
    res.json({ success: true, message: `Template ${templateId} applied` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Reset to system defaults
exports.resetToDefaults = async (req, res) => {
  try {
    // Delete custom settings triggers getOrCreate to regenerate defaults next time
    // Or explicitly reset fields here
    await InvoiceSettings.findOneAndDelete({ business: req.business._id });
    const defaults = await InvoiceSettings.getOrCreate(req.business._id);
    
    res.json({ success: true, data: defaults });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};