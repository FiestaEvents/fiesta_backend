import express from 'express';
import {
  getInvoices,
  getInvoice,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  sendInvoice,
  downloadInvoice,
  markAsPaid,
  cancelInvoice,
  getInvoiceStats,
  getInvoicesByClient,
  getInvoicesByPartner,
  getInvoicesByEvent,
} from '../controllers/invoiceController.js';
import { authenticate, authorize, attachVenue } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication and venue attachment to all routes
router.use(authenticate);
router.use(attachVenue);

// Debug middleware (optional - remove in production)
router.use((req, res, next) => {
  console.log('👤 User role:', req.user.roleId?.name || req.user.role);
  console.log('👤 User data:', {
    id: req.user._id,
    name: req.user.firstName + ' ' + req.user.lastName,
    role: req.user.roleId?.name || req.user.role,
    venue: req.venue?.name
  });
  next();
});

// ============================================
// INVOICE ROUTES
// ============================================

// Stats route - must come before /:id to avoid conflicts
router.route('/stats')
  .get(authorize('Owner', 'Manager', 'Staff', 'Viewer'), getInvoiceStats);

// Client invoices route
router.route('/client/:clientId')
  .get(authorize('Owner', 'Manager', 'Staff', 'Viewer'), getInvoicesByClient);

// Partner invoices route
router.route('/partner/:partnerId')
  .get(authorize('Owner', 'Manager', 'Staff', 'Viewer'), getInvoicesByPartner);

// Event invoices route
router.route('/event/:eventId')
  .get(authorize('Owner', 'Manager', 'Staff', 'Viewer'), getInvoicesByEvent);

// Main invoice routes
router.route('/')
  .get(authorize('Owner', 'Manager', 'Staff', 'Viewer'), getInvoices)
  .post(authorize('Owner', 'Manager', 'Staff'), createInvoice);

// Single invoice routes
router.route('/:id')
  .get(authorize('Owner', 'Manager', 'Staff', 'Viewer'), getInvoice)
  .put(authorize('Owner', 'Manager', 'Staff'), updateInvoice)
  .delete(authorize('Owner', 'Manager'), deleteInvoice);

// Invoice action routes
router.route('/:id/send')
  .post(authorize('Owner', 'Manager', 'Staff'), sendInvoice);

router.route('/:id/download')
  .get(authorize('Owner', 'Manager', 'Staff', 'Viewer'), downloadInvoice);

router.route('/:id/paid')
  .patch(authorize('Owner', 'Manager', 'Staff'), markAsPaid);

router.route('/:id/cancel')
  .patch(authorize('Owner', 'Manager'), cancelInvoice);

export default router;