import Invoice from "../models/Invoice.js";
import InvoiceSettings from "../models/InvoiceSettings.js";
import Venue from "../models/Venue.js";
import Client from "../models/Client.js";
import { generateInvoicePDF } from "../utils/generateInvoicePDF.js";
import { sendInvoiceEmail } from "../utils/sendEmail.js";

// --- READ ---
export const getAllInvoices = async (req, res) => {
  try {
    const { page = 1, limit = 10, invoiceType, status } = req.query;
    const venueId = req.user.venueId;

    const query = { venue: venueId, isArchived: { $ne: true } };
    if (invoiceType) query.invoiceType = invoiceType;
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [invoices, total] = await Promise.all([
      Invoice.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate("client", "name company email")
        .populate("partner", "name company")
        .lean(),
      Invoice.countDocuments(query)
    ]);

    res.json({
      success: true,
      invoices,
      pagination: { total, pages: Math.ceil(total / limit), current: parseInt(page) }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getInvoiceById = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, venue: req.user.venueId })
      .populate("client").populate("partner").populate("event");
    if(!invoice) return res.status(404).json({message: "Not Found"});
    res.json({ success: true, invoice });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getInvoiceStats = async (req, res) => {
  try {
    const venueId = req.user.venueId;
    const stats = await Invoice.aggregate([
      { $match: { venue: venueId, isArchived: { $ne: true } } },
      { $group: { _id: "$status", count: { $sum: 1 }, total: { $sum: "$totalAmount" } } }
    ]);
    
    // Safe reduction
    const safeTotal = (status) => stats.find(s => s._id === status)?.total || 0;
    const safeCount = (status) => stats.find(s => s._id === status)?.count || 0;

    res.json({
      success: true,
      stats: {
        totalRevenue: stats.reduce((acc, curr) => acc + curr.total, 0),
        paid: safeTotal('paid'),
        totalDue: safeTotal('sent') + safeTotal('overdue') + safeTotal('partial'),
        overdue: safeCount('overdue')
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --- WRITE ---
export const createInvoice = async (req, res) => {
  try {
    // Link Client data
    let recipientData = {};
    if (req.body.client) {
      const client = await Client.findById(req.body.client);
      if(client) {
        recipientData = {
          recipientName: client.name,
          recipientEmail: client.email,
          recipientCompany: client.company,
          recipientAddress: client.address
        };
      }
    }

    const invoice = await Invoice.create({
      ...req.body,
      ...recipientData,
      venue: req.user.venueId,
      createdBy: req.user._id
    });
    res.status(201).json({ success: true, invoice });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOneAndUpdate(
      { _id: req.params.id, venue: req.user.venueId },
      req.body,
      { new: true }
    );
    res.json({ success: true, invoice });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteInvoice = async (req, res) => {
  try {
    await Invoice.findOneAndUpdate({ _id: req.params.id }, { isArchived: true });
    res.json({ success: true, message: "Archived" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --- ACTIONS ---
export const downloadInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate("client partner");
    const venue = await Venue.findById(req.user.venueId);
    const settings = await InvoiceSettings.findOne({ venue: req.user.venueId });

    const pdfBuffer = await generateInvoicePDF(invoice, venue, req.query.language, settings);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=${invoice.invoiceNumber}.pdf`,
      "Content-Length": pdfBuffer.length
    });
    res.send(pdfBuffer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "PDF Generation Failed" });
  }
};

export const sendInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate("client partner");
    if(!invoice.recipientEmail) return res.status(400).json({ message: "No recipient email" });

    const venue = await Venue.findById(req.user.venueId);
    const settings = await InvoiceSettings.findOne({ venue: req.user.venueId });
    
    // 1. Generate PDF
    const pdfBuffer = await generateInvoicePDF(invoice, venue, 'fr', settings);
    
    // 2. Send Email
    const sent = await sendInvoiceEmail({
      to: invoice.recipientEmail,
      subject: `Invoice ${invoice.invoiceNumber} from ${venue.name}`,
      text: req.body.message || "Please find your invoice attached.",
      pdfBuffer,
      filename: `${invoice.invoiceNumber}.pdf`
    });

    if(sent) {
      invoice.status = 'sent';
      invoice.sentAt = new Date();
      await invoice.save();
      res.json({ success: true, message: "Email Sent" });
    } else {
      res.status(500).json({ message: "Email failed to send" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const markAsPaid = async (req, res) => {
  try {
    await Invoice.findByIdAndUpdate(req.params.id, {
      status: 'paid',
      'paymentStatus.amountPaid': req.body.amount || 0, // Logic simplified for now
      'paymentStatus.amountDue': 0
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const cancelInvoice = async (req, res) => {
  try {
    await Invoice.findByIdAndUpdate(req.params.id, { status: 'cancelled' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};