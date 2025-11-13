import mongoose from 'mongoose';
import Invoice from '../models/Invoice.js';
import Client from '../models/Client.js';
import Partner from '../models/Partner.js';
import Payment from '../models/Payment.js';
import Event from '../models/Event.js';
import { sendInvoiceEmail } from '../utils/emailService.js';
import PDFDocument from 'pdfkit';
import { formatCurrency } from '../utils/formatters.js';
import { format } from 'date-fns';
// ============================================
// @desc    Get all invoices for venue (non-archived by default)
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
      isArchived = false, // New parameter to include archived invoices
    } = req.query;

    const venueId = req.user.venueId;
    const query = { venue: venueId };

    // Handle archive filter
    if (isArchived === "true" || isArchived === true) {
      query.isArchived = true;
    } else {
      query.isArchived = { $ne: true };
    }

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
      .populate('archivedBy', 'name email')
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
// @desc    Get single invoice (including archived)
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
      .populate('lastModifiedBy', 'name email')
      .populate('archivedBy', 'name email');

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
        isArchived: { $ne: true }
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
        isArchived: { $ne: true }
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
        isArchived: { $ne: true }
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
      isArchived: false, // Ensure new invoices are not archived
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
      isArchived: { $ne: true }
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
        isArchived: { $ne: true }
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
        isArchived: { $ne: true }
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
// @desc    Archive invoice (soft delete)
// @route   DELETE /api/v1/invoices/:id
// @access  Private
// ============================================
export const deleteInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      venue: req.user.venueId,
      isArchived: { $ne: true }
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

    // Archive the invoice instead of deleting
    const archivedInvoice = await Invoice.archiveInvoice(req.params.id, req.user.id);

    res.json({
      success: true,
      data: { invoice: archivedInvoice },
      message: 'Invoice archived successfully',
    });
  } catch (error) {
    console.error('Archive invoice error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while archiving invoice',
    });
  }
};

// ============================================
// @desc    Restore archived invoice
// @route   PATCH /api/v1/invoices/:id/restore
// @access  Private
// ============================================
export const restoreInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      venue: req.user.venueId,
      isArchived: true
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Archived invoice not found',
      });
    }

    const restoredInvoice = await Invoice.restoreInvoice(req.params.id);

    res.json({
      success: true,
      data: { invoice: restoredInvoice },
      message: 'Invoice restored successfully',
    });
  } catch (error) {
    console.error('Restore invoice error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while restoring invoice',
    });
  }
};

// ============================================
// @desc    Get archived invoices
// @route   GET /api/v1/invoices/archived
// @access  Private
// ============================================
export const getArchivedInvoices = async (req, res) => {
  try {
    const {
      search,
      invoiceType,
      page = 1,
      limit = 10,
      sortBy = 'archivedAt',
      sortOrder = 'desc',
    } = req.query;

    const venueId = req.user.venueId;
    const query = { 
      venue: venueId,
      isArchived: true 
    };

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

    // Sort configuration
    const sortConfig = {};
    sortConfig[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const invoices = await Invoice.find(query)
      .populate('client', 'name email phone')
      .populate('partner', 'name email phone company category')
      .populate('event', 'title startDate')
      .populate('archivedBy', 'name email')
      .sort(sortConfig)
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
    console.error('Get archived invoices error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching archived invoices',
    });
  }
};

// ============================================
// @desc    Bulk archive invoices
// @route   POST /api/v1/invoices/bulk-archive
// @access  Private
// ============================================
export const bulkArchiveInvoices = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invoice IDs array is required',
      });
    }

    const result = await Invoice.updateMany(
      {
        _id: { $in: ids },
        venue: req.user.venueId,
        isArchived: false,
      },
      {
        $set: {
          isArchived: true,
          archivedAt: new Date(),
          archivedBy: req.user.id,
        },
      }
    );

    res.json({
      success: true,
      data: { archived: result.modifiedCount },
      message: `${result.modifiedCount} invoice(s) archived successfully`,
    });
  } catch (error) {
    console.error('Bulk archive invoices error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while bulk archiving invoices',
    });
  }
};

// ============================================
// @desc    Bulk restore invoices
// @route   POST /api/v1/invoices/bulk-restore
// @access  Private
// ============================================
export const bulkRestoreInvoices = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invoice IDs array is required',
      });
    }

    const result = await Invoice.updateMany(
      {
        _id: { $in: ids },
        venue: req.user.venueId,
        isArchived: true,
      },
      {
        $set: {
          isArchived: false,
          archivedAt: null,
          archivedBy: null,
        },
      }
    );

    res.json({
      success: true,
      data: { restored: result.modifiedCount },
      message: `${result.modifiedCount} invoice(s) restored successfully`,
    });
  } catch (error) {
    console.error('Bulk restore invoices error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while bulk restoring invoices',
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
      isArchived: { $ne: true }
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
    }).populate('client partner event');

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found',
      });
    }

    const Venue = mongoose.model('Venue');
    const venue = await Venue.findById(req.user.venueId);

    if (!venue) {
      return res.status(404).json({
        success: false,
        error: 'Venue not found',
      });
    }

    console.log(`Generating PDF for invoice: ${invoice.invoiceNumber}`);
    
    const pdfBuffer = await generateInvoicePDF(invoice, venue);

    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error('Generated PDF is empty');
    }

    console.log(`PDF generated successfully, size: ${pdfBuffer.length} bytes`);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=invoice-${invoice.invoiceNumber}.pdf`,
      'Content-Length': pdfBuffer.length,
    });

    res.send(pdfBuffer);

  } catch (error) {
    console.error('Download invoice error:', error);
    
    // Send JSON error for API calls, but make sure it's not after headers are sent
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: `Failed to generate PDF: ${error.message}`,
      });
    }
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
      isArchived: { $ne: true }
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
      isArchived: { $ne: true }
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
// @desc    Get invoice statistics (non-archived only)
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
          isArchived: { $ne: true },
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
// @desc    Get invoices by client (non-archived only)
// @route   GET /api/v1/invoices/client/:clientId
// @access  Private
// ============================================
export const getInvoicesByClient = async (req, res) => {
  try {
    const invoices = await Invoice.find({
      venue: req.user.venueId,
      client: req.params.clientId,
      invoiceType: 'client',
      isArchived: { $ne: true }
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
// @desc    Get invoices by partner (non-archived only)
// @route   GET /api/v1/invoices/partner/:partnerId
// @access  Private
// ============================================
export const getInvoicesByPartner = async (req, res) => {
  try {
    const invoices = await Invoice.find({
      venue: req.user.venueId,
      partner: req.params.partnerId,
      invoiceType: 'partner',
      isArchived: { $ne: true }
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
// @desc    Get invoices by event (non-archived only)
// @route   GET /api/v1/invoices/event/:eventId
// @access  Private
// ============================================
export const getInvoicesByEvent = async (req, res) => {
  try {
    const invoices = await Invoice.find({
      venue: req.user.venueId,
      event: req.params.eventId,
      isArchived: { $ne: true }
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
// ============================================
// @desc    Generate A4 printable invoice PDF (Fiesta style)
// @route   Utility function
// @layout  Professional layout with Fiesta orange branding
// ============================================
export const generateInvoicePDF = async (invoice, venue) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 50,
      });

      const buffers = [];
      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", reject);

      // Define colors - Fiesta branding
      const primaryColor = "#F18237"; // Fiesta orange
      const darkGray = "#374151";
      const lightGray = "#F9FAFB";
      const borderGray = "#E5E7EB";

      // ================= HEADER =================
      const headerY = 50;
      
      // Left: Venue info
      doc
        .font("Helvetica-Bold")
        .fontSize(20)
        .fillColor(darkGray)
        .text(venue.name, 50, headerY);

      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#6B7280")
        .text(
          venue.address?.street || venue.contact?.address || "Address not specified",
          50,
          headerY + 25
        );

      const contactLine = [];
      if (venue.contact?.phone) contactLine.push(`Phone: ${venue.contact.phone}`);
      if (venue.contact?.email) contactLine.push(`Email: ${venue.contact.email}`);
      
      doc.text(contactLine.join(" | "), 50, headerY + 38);

// Right: Invoice number and dates
doc
  .font("Helvetica-Bold")
  .fontSize(16)
  .fillColor(darkGray)
  .text(`Invoice #${invoice.invoiceNumber}`, 350, headerY, {
    align: "right",
    width: 200,
  });

// Invoice dates
doc
  .font("Helvetica")
  .fontSize(9)
  .fillColor("#6B7280")
  .text(
    `Issued: ${format(new Date(invoice.issueDate), "dd/MM/yyyy")}`,
    350,
    headerY + 20,
    { align: "right", width: 200 }
  )
  .text(
    `Due: ${format(new Date(invoice.dueDate), "dd/MM/yyyy")}`,
    350,
    headerY + 33,
    { align: "right", width: 200 }
  );

      // ================= BILL TO & INVOICE DETAILS =================
      let currentY = headerY + 90;
      
      const leftBoxX = 50;
      const rightBoxX = 310;
      const boxWidth = 240;
      const boxHeight = 90;

      // Left box: Bill To
      doc
        .roundedRect(leftBoxX, currentY, boxWidth, boxHeight, 5)
        .fillAndStroke(lightGray, borderGray);

      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor(darkGray)
        .text("Bill To:", leftBoxX + 15, currentY + 15);

      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor(darkGray)
        .text(invoice.recipientName || "N/A", leftBoxX + 15, currentY + 35);

      if (invoice.recipientEmail) {
        doc
          .fontSize(9)
          .fillColor("#6B7280")
          .text(invoice.recipientEmail, leftBoxX + 15, currentY + 50);
      }

      if (invoice.recipientPhone) {
        doc
          .fontSize(9)
          .fillColor("#6B7280")
          .text(invoice.recipientPhone, leftBoxX + 15, currentY + 63);
      }

      // Right box: Invoice Details
      doc
        .roundedRect(rightBoxX, currentY, boxWidth, boxHeight, 5)
        .fillAndStroke(lightGray, borderGray);

      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor(darkGray)
        .text("Invoice Details:", rightBoxX + 15, currentY + 15);

      const detailsY = currentY + 35;
      const labelX = rightBoxX + 15;
      const valueX = rightBoxX + 100;

      // Due Date
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#6B7280")
        .text("Due Date:", labelX, detailsY);
      doc
        .fillColor(darkGray)
        .text(format(new Date(invoice.dueDate), "dd/MM/yyyy"), valueX, detailsY);

      // Event (if available)
      const eventName = invoice.event?.title || invoice.eventName || "N/A";
      doc
        .fillColor("#6B7280")
        .text("Event:", labelX, detailsY + 15);
      doc
        .fillColor(darkGray)
        .text(eventName, valueX, detailsY + 15, { width: 130 });

      // Currency
      doc
        .fillColor("#6B7280")
        .text("Currency:", labelX, detailsY + 30);
      doc
        .fillColor(darkGray)
        .text(invoice.currency || "TND", valueX, detailsY + 30);

// ================= ITEMS TABLE =================
currentY += boxHeight + 30;

const tableX = 50;
const tableWidth = 500;
const colWidths = [260, 60, 90, 90]; // Description, Qty, Rate, Amount

// Table header
doc
  .roundedRect(tableX, currentY, tableWidth, 25, 3)
  .fillAndStroke(primaryColor, primaryColor);

doc
  .font("Helvetica-Bold")
  .fontSize(10)
  .fillColor("#FFFFFF");

// FIXED: Changed variable name to avoid duplicate declaration
const tableHeaderY = currentY + 8;
doc.text("Description", tableX + 10, tableHeaderY);
doc.text("Qty", tableX + colWidths[0] + 10, tableHeaderY, { width: colWidths[1], align: "center" });
doc.text("Rate", tableX + colWidths[0] + colWidths[1] + 10, tableHeaderY, { width: colWidths[2], align: "right" });
doc.text("Amount", tableX + colWidths[0] + colWidths[1] + colWidths[2] + 10, tableHeaderY, { width: colWidths[3] - 20, align: "right" });

currentY += 30;

// Table items
doc.font("Helvetica").fontSize(9).fillColor(darkGray);

invoice.items?.forEach((item, index) => {
  if (currentY > 700) {
    doc.addPage();
    currentY = 50;
  }

  const rowHeight = 25;
  
  // Alternate row background
  if (index % 2 === 0) {
    doc
      .rect(tableX, currentY, tableWidth, rowHeight)
      .fillAndStroke("#FAFAFA", "#FAFAFA");
  }

  const textY = currentY + 8;

  // Description
  doc
    .fillColor(darkGray)
    .text(item.description || "", tableX + 10, textY, {
      width: colWidths[0] - 20,
      ellipsis: true,
    });

  // Quantity
  doc.text(
    (item.quantity || 1).toString(),
    tableX + colWidths[0] + 10,
    textY,
    { width: colWidths[1], align: "center" }
  );

  // Rate - FIXED: Pass empty string for currency to avoid symbol in table
  doc.text(
    formatCurrency(item.rate || 0, ""), // Empty string for no currency symbol
    tableX + colWidths[0] + colWidths[1] + 10,
    textY,
    { width: colWidths[2], align: "right" }
  );

  // Amount - FIXED: Pass empty string for currency to avoid symbol in table
  doc.text(
    formatCurrency(item.amount || 0, ""), // Empty string for no currency symbol
    tableX + colWidths[0] + colWidths[1] + colWidths[2] + 10,
    textY,
    { width: colWidths[3] - 20, align: "right" }
  );

  currentY += rowHeight;
});

// ================= TOTALS SECTION =================
currentY += 20;

const totalsX = 350;
const totalsLabelX = totalsX;
const totalsValueX = totalsX + 100;
const totalsWidth = 200;

doc.font("Helvetica").fontSize(10).fillColor(darkGray);

// Subtotal - FIXED: Pass currency and show symbol
doc.text("Subtotal:", totalsLabelX, currentY);
doc.text(
  formatCurrency(invoice.subtotal || 0, invoice.currency, true), // Show currency symbol
  totalsValueX,
  currentY,
  { width: 100, align: "right" }
);

// Tax (if applicable)
if (invoice.tax > 0) {
  currentY += 18;
  doc.text(`Tax (${invoice.taxRate || 19}%):`, totalsLabelX, currentY);
  doc.text(
    formatCurrency(invoice.tax || 0, invoice.currency, true), 
    totalsValueX,
    currentY,
    { width: 100, align: "right" }
  );
}

// Discount (if applicable)
if (invoice.discount > 0) {
  currentY += 18;
  doc.text("Discount:", totalsLabelX, currentY);
  doc
    .fillColor("#EF4444")
    .text(
      `-${formatCurrency(invoice.discount || 0, invoice.currency, true)}`, 
      totalsValueX,
      currentY,
      { width: 100, align: "right" }
    );
  doc.fillColor(darkGray);
}

// Total (highlighted)
currentY += 25;
doc
  .roundedRect(totalsX, currentY - 5, totalsWidth, 30, 5)
  .fillAndStroke(primaryColor, primaryColor);

doc
  .font("Helvetica-Bold")
  .fontSize(12)
  .fillColor("#FFFFFF")
  .text("Total:", totalsLabelX + 5, currentY + 3);
doc.text(
  formatCurrency(invoice.totalAmount || 0, invoice.currency, true), // Show currency symbol
  totalsValueX,
  currentY + 3,
  { width: 95, align: "right" }
);

      // ================= NOTES & TERMS =================
      currentY += 50;
      doc.fillColor(darkGray);

      if (invoice.notes) {
        doc.font("Helvetica-Bold").fontSize(10).text("Notes:", 50, currentY);
        currentY += 15;
        doc
          .font("Helvetica")
          .fontSize(9)
          .fillColor("#6B7280")
          .text(invoice.notes, 50, currentY, {
            width: 500,
            lineGap: 3,
          });
        currentY += doc.heightOfString(invoice.notes, { width: 500 }) + 15;
      }

      if (invoice.terms) {
        doc
          .font("Helvetica-Bold")
          .fontSize(10)
          .fillColor(darkGray)
          .text("Terms & Conditions:", 50, currentY);
        currentY += 15;
        doc
          .font("Helvetica")
          .fontSize(9)
          .fillColor("#6B7280")
          .text(invoice.terms, 50, currentY, {
            width: 500,
            lineGap: 3,
          });
      }

      doc.end();
    } catch (err) {
      reject(new Error(`PDF generation failed: ${err.message}`));
    }
  });
};