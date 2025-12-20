import InvoiceSettings from "../models/InvoiceSettings.js";

export const getInvoiceSettings = async (req, res) => {
  try {
    const settings = await InvoiceSettings.getOrCreate(req.user.venueId);
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateInvoiceSettings = async (req, res) => {
  try {
    const settings = await InvoiceSettings.findOneAndUpdate(
      { venue: req.user.venueId },
      req.body,
      { new: true, upsert: true }
    );
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const previewInvoice = async (req, res) => res.json({ success: true });
export const applyTemplate = async (req, res) => res.json({ success: true });
export const resetToDefaults = async (req, res) => res.json({ success: true });