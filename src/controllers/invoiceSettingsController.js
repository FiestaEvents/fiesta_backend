import InvoiceSettings from "../models/InvoiceSettings.js";

/**
 * @desc    Get invoice settings
 * @route   GET /api/v1/invoices/settings
 */
export const getInvoiceSettings = async (req, res) => {
  try {
    const businessId = req.businessId || req.user.businessId;
    // Uses the static method refactored in the Model to get settings for this Business
    const settings = await InvoiceSettings.getOrCreate(businessId);
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Update invoice settings
 * @route   PUT /api/v1/invoices/settings
 */
export const updateInvoiceSettings = async (req, res) => {
  try {
    const businessId = req.businessId || req.user.businessId;
    
    // Update using 'businessId' field matching the Schema
    const settings = await InvoiceSettings.findOneAndUpdate(
      { businessId: businessId }, 
      req.body,
      { new: true, upsert: true }
    );
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Preview invoice (Placeholder)
 * @route   POST /api/v1/invoices/settings/preview
 */
export const previewInvoice = async (req, res) => {
  res.json({ success: true, message: "Preview generated" });
};

/**
 * @desc    Apply template
 * @route   POST /api/v1/invoices/settings/apply-template
 */
export const applyTemplate = async (req, res) => {
  try {
    const { templateId } = req.body;
    // Logic to fetch template config and apply to settings would go here
    res.json({ success: true, message: `Template ${templateId} applied` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Reset to defaults
 * @route   POST /api/v1/invoices/settings/reset
 */
export const resetToDefaults = async (req, res) => {
  try {
    const businessId = req.businessId || req.user.businessId;
    
    // Delete custom settings triggers getOrCreate to regenerate defaults next time
    await InvoiceSettings.findOneAndDelete({ businessId: businessId });
    const defaults = await InvoiceSettings.getOrCreate(businessId);
    
    res.json({ success: true, data: defaults });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};