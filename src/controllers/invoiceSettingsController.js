import InvoiceSettings from "../models/InvoiceSettings.js";

export const getInvoiceSettings = async (req, res) => {
  try {
    const settings = await InvoiceSettings.getOrCreate(req.business._id);
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateInvoiceSettings = async (req, res) => {
  try {
    // 1. Sanitize the payload
    const updateData = { ...req.body };

    // Remove fields that should NEVER be manually updated
    delete updateData._id;
    delete updateData.business;
    delete updateData.businessId;
    delete updateData.createdAt;
    delete updateData.updatedAt;
    delete updateData.__v;

    // 2. Perform the update
    const settings = await InvoiceSettings.findOneAndUpdate(
      { business: req.business._id },
      updateData,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, data: settings });
  } catch (error) {
    console.error("Update Settings Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const previewInvoice = async (req, res) => {
  res.json({ success: true, message: "Preview generated" });
};

export const applyTemplate = async (req, res) => {
  try {
    const { templateId } = req.body;
    res.json({ success: true, message: `Template ${templateId} applied` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const resetToDefaults = async (req, res) => {
  try {
    await InvoiceSettings.findOneAndDelete({ business: req.business._id });
    const defaults = await InvoiceSettings.getOrCreate(req.business._id);

    res.json({ success: true, data: defaults });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
