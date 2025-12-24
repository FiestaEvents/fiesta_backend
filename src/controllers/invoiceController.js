// src/controllers/invoiceController.js
const Invoice = require("../models/Invoice");
const InvoiceSettings = require("../models/InvoiceSettings");
const Business = require("../models/Business");
const Client = require("../models/Client");
const { generateInvoicePDF } = require("../utils/generateInvoicePDF");
const { sendInvoiceEmail } = require("../utils/sendEmail");

exports.getAllInvoices = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      invoiceType, 
      status, 
      search
    } = req.query;
    
    // ARCHITECTURE UPDATE: Use businessId
    const businessId = req.business._id;

    const query = { business: businessId, isArchived: { $ne: true } };

    // --- START SEARCH LOGIC ---
    if (search) {
      const searchRegex = new RegExp(search, "i"); // Case-insensitive

      // 1. Find matching Clients (if searching for a name/company)
      const matchingClients = await Client.find({
        businessId: businessId, // Updated
        $or: [
          { name: searchRegex }, 
          { company: searchRegex }, 
          { email: searchRegex }
        ]
      }).select("_id");
      
      const clientIds = matchingClients.map(c => c._id);

      // 2. Build the $or query for Invoices
      query.$or = [
        { invoiceNumber: searchRegex },        // Search Invoice #
        { recipientName: searchRegex },        // Search Snapshot Name
        { recipientCompany: searchRegex },     // Search Snapshot Company
        { recipientEmail: searchRegex },       // Search Snapshot Email
        { client: { $in: clientIds } }         // Search linked Client IDs
      ];
    }
    // --- END SEARCH LOGIC ---

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
      pagination: { 
        total, 
        pages: Math.ceil(total / limit), 
        current: parseInt(page) 
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getInvoiceById = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ 
      _id: req.params.id, 
      business: req.business._id // Updated
    })
      .populate("client")
      .populate("partner")
      .populate("event");
      
    if(!invoice) return res.status(404).json({message: "Not Found"});
    res.json({ success: true, invoice });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getInvoiceStats = async (req, res) => {
  try {
    const businessId = req.business._id;
    const stats = await Invoice.aggregate([
      { $match: { business: businessId, isArchived: { $ne: true } } },
      { $group: { _id: "$status", count: { $sum: 1 }, total: { $sum: "$totalAmount" } } }
    ]);
    
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
exports.createInvoice = async (req, res) => {
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
      business: req.business._id, // Updated
      createdBy: req.user._id
    });
    res.status(201).json({ success: true, invoice });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOneAndUpdate(
      { _id: req.params.id, business: req.business._id },
      req.body,
      { new: true }
    );
    res.json({ success: true, invoice });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteInvoice = async (req, res) => {
  try {
    await Invoice.findOneAndUpdate(
      { _id: req.params.id, business: req.business._id }, 
      { isArchived: true }
    );
    res.json({ success: true, message: "Archived" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --- ACTIONS ---
exports.downloadInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ 
      _id: req.params.id, 
      business: req.business._id 
    }).populate("client partner");
    
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    // Fetch Business instead of Venue
    const business = await Business.findById(req.business._id);
    const settings = await InvoiceSettings.findOne({ business: req.business._id });

    const pdfBuffer = await generateInvoicePDF(invoice, business, req.query.language, settings);

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

exports.sendInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      business: req.business._id
    }).populate("client partner");
    
    if(!invoice) return res.status(404).json({ message: "Invoice not found" });
    if(!invoice.recipientEmail) return res.status(400).json({ message: "No recipient email" });

    const business = await Business.findById(req.business._id);
    const settings = await InvoiceSettings.findOne({ business: req.business._id });
    
    // 1. Generate PDF
    const pdfBuffer = await generateInvoicePDF(invoice, business, 'fr', settings);
    
    // 2. Send Email
    const sent = await sendInvoiceEmail({
      to: invoice.recipientEmail,
      subject: `Invoice ${invoice.invoiceNumber} from ${business.name}`,
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

exports.markAsPaid = async (req, res) => {
  try {
    await Invoice.findOneAndUpdate(
      { _id: req.params.id, business: req.business._id },
      {
        status: 'paid',
        'paymentStatus.amountPaid': req.body.amount || 0,
        'paymentStatus.amountDue': 0
      }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.cancelInvoice = async (req, res) => {
  try {
    await Invoice.findOneAndUpdate(
      { _id: req.params.id, business: req.business._id },
      { status: 'cancelled' }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};