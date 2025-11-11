import mongoose from 'mongoose';
import Invoice from '../models/Invoice.js';
import Client from '../models/Client.js';
import Partner from '../models/Partner.js';
import Payment from '../models/Payment.js';
import Event from '../models/Event.js';
import { sendInvoiceEmail } from '../utils/emailService.js';
import PDFDocument from 'pdfkit';

// ============================================
// UTILITY: GENERATE PDF (UPDATED TO MATCH FRONTEND)
// ============================================
const generateInvoicePDF = async (invoice, venue) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        margin: 50,
        size: 'A4',
        info: {
          Title: `Invoice ${invoice.invoiceNumber}`,
          Author: venue.name,
          Subject: `Invoice for ${invoice.recipientName}`
        }
      });
      const chunks = [];
      
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Determine if it's a client or partner invoice
      const isClientInvoice = invoice.invoiceType === 'client';
      
      // Colors matching frontend
      const colors = {
        primary: '#ea580c', // orange-600
        secondary: '#6b7280', // gray-500
        dark: '#1f2937', // gray-900
        light: '#9ca3af', // gray-400
        success: '#16a34a', // green-600
        warning: '#d97706', // yellow-600
        danger: '#dc2626', // red-600
        info: '#2563eb' // blue-600
      };

      // Header Section - Matching frontend modal header
      doc
        .fillColor(colors.dark)
        .fontSize(24)
        .font('Helvetica-Bold')
        .text(`Invoice #${invoice.invoiceNumber}`, 50, 50)
        .fontSize(12)
        .font('Helvetica')
        .fillColor(colors.secondary)
        .text(`Issued: ${invoice.issueDate.toLocaleDateString()}`, 50, 85);

      if (invoice.sentAt) {
        doc.text(`Sent: ${invoice.sentAt.toLocaleDateString()}`, 50, 100);
      }
      // Recipient Information Section - Matching frontend layout
      doc
        .fillColor(colors.dark)
        .fontSize(14)
        .font('Helvetica-Bold')
        .text(isClientInvoice ? 'Bill To:' : 'Pay To:', 50, 150)
        .fontSize(12)
        .font('Helvetica')
        .fillColor(colors.dark)
        .text(invoice.recipientName, 50, 175);

      let recipientY = 195;
      if (invoice.recipientCompany) {
        doc
          .fillColor(colors.secondary)
          .text(invoice.recipientCompany, 50, recipientY);
        recipientY += 20;
      }

      if (invoice.recipientEmail) {
        doc.text(invoice.recipientEmail, 50, recipientY);
        recipientY += 20;
      }

      if (invoice.recipientPhone) {
        doc.text(invoice.recipientPhone, 50, recipientY);
        recipientY += 20;
      }

      if (invoice.recipientAddress?.street) {
        doc.text(invoice.recipientAddress.street, 50, recipientY);
        recipientY += 15;
        const cityStateZip = [
          invoice.recipientAddress.city,
          invoice.recipientAddress.state,
          invoice.recipientAddress.zipCode
        ].filter(Boolean).join(', ');
        doc.text(cityStateZip, 50, recipientY);
        recipientY += 20;
      }

      // Invoice Details Section - Right aligned like frontend
      doc
        .fillColor(colors.dark)
        .fontSize(14)
        .font('Helvetica-Bold')
        .text('Invoice Details:', 350, 150)
        .fontSize(12)
        .font('Helvetica');

      let detailsY = 175;
      
      // Due Date
      doc
        .fillColor(colors.secondary)
        .text('Due Date:', 350, detailsY)
        .fillColor(colors.dark)
        .text(invoice.dueDate.toLocaleDateString(), 450, detailsY);
      detailsY += 20;

      // Event
      if (invoice.event) {
        doc
          .fillColor(colors.secondary)
          .text('Event:', 350, detailsY)
          .fillColor(colors.dark)
          .text(invoice.event.title, 450, detailsY);
        detailsY += 20;
      }

      // Currency
      if (invoice.currency) {
        doc
          .fillColor(colors.secondary)
          .text('Currency:', 350, detailsY)
          .fillColor(colors.dark)
          .text(invoice.currency, 450, detailsY);
        detailsY += 20;
      }

      // Items Table Section - Matching frontend table design
      const tableTop = Math.max(recipientY, detailsY) + 40;
      
      // Table Header with background
      doc
        .rect(50, tableTop, 500, 25)
        .fill('#f9fafb') // gray-50
        .fillColor(colors.dark)
        .fontSize(11)
        .font('Helvetica-Bold')
        .text('Description', 55, tableTop + 8)
        .text('Qty', 350, tableTop + 8)
        .text('Rate', 400, tableTop + 8)
        .text('Amount', 470, tableTop + 8);

      // Table rows
      let itemY = tableTop + 25;
      invoice.items.forEach((item, index) => {
        // Alternate row background
        if (index % 2 === 0) {
          doc.rect(50, itemY, 500, 30).fill('#ffffff');
        } else {
          doc.rect(50, itemY, 500, 30).fill('#f8fafc'); // subtle gray
        }

        doc
          .fillColor(colors.dark)
          .fontSize(10)
          .font('Helvetica')
          .text(item.description || 'No description', 55, itemY + 10, {
            width: 280,
            align: 'left'
          });

        // Category if exists
        if (item.category) {
          doc
            .fillColor(colors.light)
            .fontSize(8)
            .text(item.category.replace(/_/g, ' '), 55, itemY + 22);
        }

        doc
          .fillColor(colors.dark)
          .fontSize(10)
          .text((item.quantity || 1).toString(), 350, itemY + 10)
          .text(`${invoice.currency} ${(item.rate || 0).toFixed(2)}`, 400, itemY + 10)
          .text(`${invoice.currency} ${(item.amount || 0).toFixed(2)}`, 470, itemY + 10);

        itemY += 30;
      });

      // Totals Section - Matching frontend totals layout
      const totalsTop = itemY + 30;
      const totalsWidth = 200;

      doc
        .fillColor(colors.dark)
        .fontSize(11);

      let totalY = totalsTop;

      // Subtotal
      doc
        .text('Subtotal:', 350, totalY)
        .text(`${invoice.currency} ${(invoice.subtotal || 0).toFixed(2)}`, 470, totalY);
      totalY += 20;

      // Tax
      if (invoice.tax > 0) {
        const taxLabel = invoice.taxRate ? `Tax (${invoice.taxRate}%)` : 'Tax';
        doc
          .text(taxLabel, 350, totalY)
          .text(`${invoice.currency} ${(invoice.tax || 0).toFixed(2)}`, 470, totalY);
        totalY += 20;
      }

      // Discount
      if (invoice.discount > 0) {
        doc
          .fillColor(colors.danger)
          .text('Discount:', 350, totalY)
          .text(`-${invoice.currency} ${(invoice.discount || 0).toFixed(2)}`, 470, totalY)
          .fillColor(colors.dark);
        totalY += 20;
      }

      // Total line
      doc
        .moveTo(350, totalY)
        .lineTo(550, totalY)
        .strokeColor(colors.light)
        .stroke();
      totalY += 15;

      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .text('Total:', 350, totalY)
        .text(`${invoice.currency} ${(invoice.totalAmount || 0).toFixed(2)}`, 470, totalY);
      totalY += 25;

      // Payment status if applicable
      if (invoice.paymentStatus?.amountPaid > 0) {
        doc
          .fontSize(11)
          .font('Helvetica')
          .fillColor(colors.success)
          .text('Amount Paid:', 350, totalY)
          .text(`${invoice.currency} ${(invoice.paymentStatus.amountPaid || 0).toFixed(2)}`, 470, totalY);
        totalY += 20;

        doc
          .fontSize(14)
          .font('Helvetica-Bold')
          .fillColor(colors.dark)
          .text('Amount Due:', 350, totalY)
          .text(`${invoice.currency} ${(invoice.paymentStatus.amountDue || 0).toFixed(2)}`, 470, totalY);
        totalY += 20;
      }

      // Notes & Terms Section - Matching frontend layout
      let contentY = totalY + 50;

      if (invoice.notes || invoice.terms) {
        doc
          .moveTo(50, contentY)
          .lineTo(550, contentY)
          .strokeColor(colors.light)
          .stroke();
        contentY += 30;

        if (invoice.notes) {
          doc
            .fillColor(colors.dark)
            .fontSize(12)
            .font('Helvetica-Bold')
            .text('Notes', 50, contentY)
            .fontSize(10)
            .font('Helvetica')
            .fillColor(colors.secondary)
            .text(invoice.notes, 50, contentY + 20, {
              width: 500,
              align: 'left'
            });
          
          // Calculate height needed for notes and move Y position
          const notesHeight = doc.heightOfString(invoice.notes, { width: 500 }) + 40;
          contentY += notesHeight;
        }

        if (invoice.terms) {
          doc
            .fillColor(colors.dark)
            .fontSize(12)
            .font('Helvetica-Bold')
            .text('Terms & Conditions', 50, contentY)
            .fontSize(10)
            .font('Helvetica')
            .fillColor(colors.secondary)
            .text(invoice.terms, 50, contentY + 20, {
              width: 500,
              align: 'left'
            });
          
          // Calculate height needed for terms and move Y position
          const termsHeight = doc.heightOfString(invoice.terms, { width: 500 }) + 40;
          contentY += termsHeight;
        }
      }

      // Add some space before footer
      contentY += 20;

      // Check if we need a new page for the footer
      if (contentY > doc.page.height - 100) {
        doc.addPage();
        contentY = 50;
      }

      // Simple centered footer - only "Thank you for your business!"
      doc
        .fillColor(colors.primary)
        .fontSize(11)
        .font('Helvetica-Bold')
        .text('Thank you for your business!', 50, contentY, { 
          align: 'center', 
          width: 500 
        });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};
// ============================================
// @desc    Get all invoices for venue
// @route   GET /api/v1/invoices
// @access  Private
// ============================================
export const getInvoices = async (req, res) => {
  try {
    const {
      search,
      status,
      invoiceType,
      client,
      partner,
      event,
      startDate,
      endDate,
      page = 1,
      limit = 10,
      sort = '-createdAt',
    } = req.query;

    const venueId = req.user.venueId;
    const query = { venue: venueId };

    // Search filter
    if (search) {
      query.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { recipientName: { $regex: search, $options: 'i' } },
        { recipientEmail: { $regex: search, $options: 'i' } },
      ];
    }

    // Invoice type filter
    if (invoiceType && invoiceType !== 'all') {
      query.invoiceType = invoiceType;
    }

    // Status filter
    if (status && status !== 'all') {
      if (status === 'unpaid') {
        query.status = { $in: ['sent', 'partial', 'overdue'] };
      } else {
        query.status = status;
      }
    }

    // Client filter
    if (client) {
      query.client = client;
    }

    // Partner filter
    if (partner) {
      query.partner = partner;
    }

    // Event filter
    if (event) {
      query.event = event;
    }

    // Date range filter
    if (startDate || endDate) {
      query.issueDate = {};
      if (startDate) query.issueDate.$gte = new Date(startDate);
      if (endDate) query.issueDate.$lte = new Date(endDate);
    }

    const invoices = await Invoice.find(query)
      .populate('client', 'name email phone')
      .populate('partner', 'name email phone company category')
      .populate('event', 'title startDate')
      .populate('createdBy', 'name email')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Invoice.countDocuments(query);

    res.json({
      success: true,
      data: {
        invoices,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
        },
      },
    });
  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching invoices',
    });
  }
};

// ============================================
// @desc    Get single invoice
// @route   GET /api/v1/invoices/:id
// @access  Private
// ============================================
export const getInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      venue: req.user.venueId,
    })
      .populate('client', 'name email phone address')
      .populate('partner', 'name email phone company category address')
      .populate('event', 'title startDate endDate type')
      .populate('payments')
      .populate('createdBy', 'name email')
      .populate('lastModifiedBy', 'name email');

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found',
      });
    }

    res.json({
      success: true,
      data: { invoice },
    });
  } catch (error) {
    console.error('Get invoice error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching invoice',
    });
  }
};

// ============================================
// @desc    Create new invoice
// @route   POST /api/v1/invoices
// @access  Private
// ============================================
export const createInvoice = async (req, res) => {
  try {
    const venueId = req.user.venueId;
    const { invoiceType, client: clientId, partner: partnerId, event: eventId } = req.body;

    // Validate invoice type
    if (!invoiceType || !['client', 'partner'].includes(invoiceType)) {
      return res.status(400).json({
        success: false,
        error: 'Valid invoice type is required (client or partner)',
      });
    }

    let recipientData = {};

    // Handle client invoice
    if (invoiceType === 'client') {
      if (!clientId) {
        return res.status(400).json({
          success: false,
          error: 'Client is required for client invoices',
        });
      }

      const client = await Client.findOne({
        _id: clientId,
        venueId: venueId,
      });

      if (!client) {
        return res.status(400).json({
          success: false,
          error: 'Client not found in your venue',
        });
      }

      recipientData = {
        recipientName: client.name,
        recipientEmail: client.email,
        recipientPhone: client.phone,
        recipientAddress: client.address,
        recipientCompany: client.company,
      };
    }

    // Handle partner invoice
    if (invoiceType === 'partner') {
      if (!partnerId) {
        return res.status(400).json({
          success: false,
          error: 'Partner is required for partner invoices',
        });
      }

      const partner = await Partner.findOne({
        _id: partnerId,
        venueId: venueId,
      });

      if (!partner) {
        return res.status(400).json({
          success: false,
          error: 'Partner not found in your venue',
        });
      }

      recipientData = {
        recipientName: partner.name,
        recipientEmail: partner.email,
        recipientPhone: partner.phone,
        recipientAddress: partner.address,
        recipientCompany: partner.company,
      };
    }

    // Validate event if provided
    if (eventId) {
      const event = await Event.findOne({
        _id: eventId,
        venueId: venueId,
      });

      if (!event) {
        return res.status(400).json({
          success: false,
          error: 'Event not found in your venue',
        });
      }
    }

    // Create invoice data
    const invoiceData = {
      ...req.body,
      ...recipientData,
      venue: venueId,
      createdBy: req.user.id,
      paymentStatus: {
        amountPaid: 0,
        amountDue: 0,
      },
    };

    // Create temporary invoice to calculate amounts
    const tempInvoice = new Invoice(invoiceData);
    tempInvoice.calculateAmounts();

    // Update with calculated amounts
    invoiceData.subtotal = tempInvoice.subtotal;
    invoiceData.tax = tempInvoice.tax;
    invoiceData.totalAmount = tempInvoice.totalAmount;
    invoiceData.paymentStatus.amountDue = tempInvoice.totalAmount;

    const invoice = await Invoice.create(invoiceData);

    // Populate the created invoice
    const populatedInvoice = await Invoice.findById(invoice._id)
      .populate('client', 'name email phone address')
      .populate('partner', 'name email phone company address')
      .populate('event', 'title startDate')
      .populate('createdBy', 'name email');

    res.status(201).json({
      success: true,
      data: { invoice: populatedInvoice },
      message: 'Invoice created successfully',
    });
  } catch (error) {
    console.error('Create invoice error:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({
        success: false,
        error: messages.join(', '),
      });
    }
    if (error.code === 11000 && error.keyPattern?.invoiceNumber) {
      return res.status(400).json({
        success: false,
        error: 'Invoice number conflict. Please try again.',
      });
    }
    res.status(500).json({
      success: false,
      error: 'Server error while creating invoice',
    });
  }
};

// ============================================
// @desc    Update invoice
// @route   PUT /api/v1/invoices/:id
// @access  Private
// ============================================
export const updateInvoice = async (req, res) => {
  try {
    let invoice = await Invoice.findOne({
      _id: req.params.id,
      venue: req.user.venueId,
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found',
      });
    }

    if (!invoice.canModify()) {
      return res.status(400).json({
        success: false,
        error: 'This invoice cannot be modified in its current status',
      });
    }

    // If client/partner is being updated, validate and update recipient data
    if (req.body.client && invoice.invoiceType === 'client') {
      const client = await Client.findOne({
        _id: req.body.client,
        venueId: req.user.venueId,
      });

      if (!client) {
        return res.status(400).json({
          success: false,
          error: 'Client not found in your venue',
        });
      }

      req.body.recipientName = client.name;
      req.body.recipientEmail = client.email;
      req.body.recipientPhone = client.phone;
      req.body.recipientAddress = client.address;
      req.body.recipientCompany = client.company;
    }

    if (req.body.partner && invoice.invoiceType === 'partner') {
      const partner = await Partner.findOne({
        _id: req.body.partner,
        venueId: req.user.venueId,
      });

      if (!partner) {
        return res.status(400).json({
          success: false,
          error: 'Partner not found in your venue',
        });
      }

      req.body.recipientName = partner.name;
      req.body.recipientEmail = partner.email;
      req.body.recipientPhone = partner.phone;
      req.body.recipientAddress = partner.address;
      req.body.recipientCompany = partner.company;
    }

    req.body.lastModifiedBy = req.user.id;

    invoice = await Invoice.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    )
      .populate('client', 'name email phone address')
      .populate('partner', 'name email phone company address')
      .populate('event', 'title startDate')
      .populate('createdBy', 'name email')
      .populate('lastModifiedBy', 'name email');

    res.json({
      success: true,
      data: { invoice },
      message: 'Invoice updated successfully',
    });
  } catch (error) {
    console.error('Update invoice error:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({
        success: false,
        error: messages.join(', '),
      });
    }
    res.status(500).json({
      success: false,
      error: 'Server error while updating invoice',
    });
  }
};

// ============================================
// @desc    Delete invoice
// @route   DELETE /api/v1/invoices/:id
// @access  Private
// ============================================
export const deleteInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      venue: req.user.venueId,
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found',
      });
    }

    if (!invoice.canDelete()) {
      return res.status(400).json({
        success: false,
        error: 'This invoice cannot be deleted. Consider cancelling it instead.',
      });
    }

    await invoice.deleteOne();

    res.json({
      success: true,
      data: {},
      message: 'Invoice deleted successfully',
    });
  } catch (error) {
    console.error('Delete invoice error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while deleting invoice',
    });
  }
};

// ============================================
// @desc    Send invoice via email
// @route   POST /api/v1/invoices/:id/send
// @access  Private
// ============================================
export const sendInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      venue: req.user.venueId,
    })
      .populate('client')
      .populate('partner');

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found',
      });
    }

    const Venue = mongoose.model('Venue');
    const venue = await Venue.findById(req.user.venueId);

    const pdfBuffer = await generateInvoicePDF(invoice, venue);

    const { email: recipientEmail, message: customMessage } = req.body;
    const emailTo = recipientEmail || invoice.recipientEmail;
    
    const isClientInvoice = invoice.invoiceType === 'client';
    const subjectLine = isClientInvoice
      ? `Invoice ${invoice.invoiceNumber} from ${venue.name}`
      : `Payment Request ${invoice.invoiceNumber} from ${venue.name}`;

    await sendInvoiceEmail({
      to: emailTo,
      subject: subjectLine,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>${isClientInvoice ? 'Invoice' : 'Payment Request'} from ${venue.name}</h2>
          <p>Dear ${invoice.recipientName},</p>
          <p>Please find your ${isClientInvoice ? 'invoice' : 'payment request'} attached.</p>
          ${customMessage ? `<p>${customMessage}</p>` : ''}
          <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Invoice Number:</strong> ${invoice.invoiceNumber}</p>
            <p style="margin: 5px 0;"><strong>Type:</strong> ${isClientInvoice ? 'Client Invoice' : 'Partner Bill'}</p>
            <p style="margin: 5px 0;"><strong>Issue Date:</strong> ${invoice.issueDate.toLocaleDateString()}</p>
            <p style="margin: 5px 0;"><strong>Due Date:</strong> ${invoice.dueDate.toLocaleDateString()}</p>
            <p style="margin: 5px 0;"><strong>Total Amount:</strong> ${invoice.currency} ${invoice.totalAmount.toFixed(2)}</p>
          </div>
          <p>If you have any questions, please don't hesitate to contact us.</p>
          <p>Best regards,<br>${venue.name}</p>
        </div>
      `,
      attachments: [
        {
          filename: `invoice-${invoice.invoiceNumber}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });

    await invoice.markAsSent(emailTo);

    res.json({
      success: true,
      data: { invoice },
      message: 'Invoice sent successfully',
    });
  } catch (error) {
    console.error('Send invoice error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while sending invoice',
    });
  }
};

// ============================================
// @desc    Download invoice PDF
// @route   GET /api/v1/invoices/:id/download
// @access  Private
// ============================================
export const downloadInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      venue: req.user.venueId,
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found',
      });
    }

    const Venue = mongoose.model('Venue');
    const venue = await Venue.findById(req.user.venueId);

    const pdfBuffer = await generateInvoicePDF(invoice, venue);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=invoice-${invoice.invoiceNumber}.pdf`,
      'Content-Length': pdfBuffer.length,
    });

    res.send(pdfBuffer);
  } catch (error) {
    console.error('Download invoice error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while generating invoice PDF',
    });
  }
};

// ============================================
// @desc    Mark invoice as paid
// @route   PATCH /api/v1/invoices/:id/paid
// @access  Private
// ============================================
export const markAsPaid = async (req, res) => {
  try {
    const { paymentMethod = '', reference = '' } = req.body;
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      venue: req.user.venueId,
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found',
      });
    }

    if (invoice.status === 'paid') {
      return res.status(400).json({
        success: false,
        error: 'Invoice is already marked as paid',
      });
    }

    const remainingAmount = invoice.paymentStatus.amountDue;

    // Determine payment type based on invoice type
    const paymentType = invoice.invoiceType === 'client' ? 'income' : 'expense';

    const payment = await Payment.create({
      type: paymentType,
      amount: remainingAmount,
      method: paymentMethod || 'cash',
      reference,
      description: `Full payment for invoice ${invoice.invoiceNumber}`,
      client: invoice.client || null,
      partner: invoice.partner || null,
      event: invoice.event,
      venueId: req.user.venueId,
      processedBy: req.user.id,
      status: 'completed',
      paidDate: new Date(),
    });

    await invoice.recordPayment(remainingAmount, paymentMethod, payment._id);

    const updatedInvoice = await Invoice.findById(invoice._id)
      .populate('client', 'name email phone')
      .populate('partner', 'name email phone company')
      .populate('payments');

    res.json({
      success: true,
      data: { invoice: updatedInvoice },
      message: 'Invoice marked as paid',
    });
  } catch (error) {
    console.error('Mark invoice as paid error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while updating invoice status',
    });
  }
};

// ============================================
// @desc    Cancel invoice
// @route   PATCH /api/v1/invoices/:id/cancel
// @access  Private
// ============================================
export const cancelInvoice = async (req, res) => {
  try {
    const { reason } = req.body;
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      venue: req.user.venueId,
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found',
      });
    }

    if (invoice.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        error: 'Invoice is already cancelled',
      });
    }

    if (invoice.paymentStatus.amountPaid > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot cancel invoice with payments. Please process refunds first.',
      });
    }

    await invoice.cancel(req.user.id, reason);

    res.json({
      success: true,
      data: { invoice },
      message: 'Invoice cancelled successfully',
    });
  } catch (error) {
    console.error('Cancel invoice error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while cancelling invoice',
    });
  }
};

// ============================================
// @desc    Get invoice statistics
// @route   GET /api/v1/invoices/stats
// @access  Private
// ============================================
export const getInvoiceStats = async (req, res) => {
  try {
    const { startDate, endDate, invoiceType } = req.query;
    const venueId = req.user.venueId;

    const stats = await Invoice.getStats(venueId, startDate, endDate, invoiceType);

    const overdueClient = await Invoice.getOverdue(venueId, 'client');
    const overduePartner = await Invoice.getOverdue(venueId, 'partner');
    
    const dueSoonClient = await Invoice.getDueSoon(venueId, 7, 'client');
    const dueSoonPartner = await Invoice.getDueSoon(venueId, 7, 'partner');

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyRevenue = await Invoice.aggregate([
      {
        $match: {
          venue: new mongoose.Types.ObjectId(venueId),
          status: 'paid',
          paidAt: { $gte: sixMonthsAgo },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$paidAt' },
            month: { $month: '$paidAt' },
            type: '$invoiceType',
          },
          revenue: { $sum: '$totalAmount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    res.json({
      success: true,
      data: {
        stats,
        overdue: {
          client: overdueClient.length,
          partner: overduePartner.length,
          total: overdueClient.length + overduePartner.length,
        },
        dueSoon: {
          client: dueSoonClient.length,
          partner: dueSoonPartner.length,
          total: dueSoonClient.length + dueSoonPartner.length,
        },
        monthlyRevenue,
      },
    });
  } catch (error) {
    console.error('Get invoice stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching invoice statistics',
    });
  }
};

// ============================================
// @desc    Get invoices by client
// @route   GET /api/v1/invoices/client/:clientId
// @access  Private
// ============================================
export const getInvoicesByClient = async (req, res) => {
  try {
    const invoices = await Invoice.find({
      venue: req.user.venueId,
      client: req.params.clientId,
      invoiceType: 'client',
    })
      .sort('-createdAt')
      .populate('event', 'title startDate');

    res.json({
      success: true,
      data: { invoices },
    });
  } catch (error) {
    console.error('Get invoices by client error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching client invoices',
    });
  }
};

// ============================================
// @desc    Get invoices by partner
// @route   GET /api/v1/invoices/partner/:partnerId
// @access  Private
// ============================================
export const getInvoicesByPartner = async (req, res) => {
  try {
    const invoices = await Invoice.find({
      venue: req.user.venueId,
      partner: req.params.partnerId,
      invoiceType: 'partner',
    })
      .sort('-createdAt')
      .populate('event', 'title startDate');

    res.json({
      success: true,
      data: { invoices },
    });
  } catch (error) {
    console.error('Get invoices by partner error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching partner invoices',
    });
  }
};

// ============================================
// @desc    Get invoices by event
// @route   GET /api/v1/invoices/event/:eventId
// @access  Private
// ============================================
export const getInvoicesByEvent = async (req, res) => {
  try {
    const invoices = await Invoice.find({
      venue: req.user.venueId,
      event: req.params.eventId,
    })
      .sort('-createdAt')
      .populate('client', 'name email')
      .populate('partner', 'name email company');

    res.json({
      success: true,
      data: { invoices },
    });
  } catch (error) {
    console.error('Get invoices by event error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching event invoices',
    });
  }
};