// src/routes/eventRoutes.js
const express = require('express');
const {
  getEvents,
  getEventsByClient,
  getEvent,
  createEvent,
  updateEvent,
  archiveEvent,
  restoreEvent,
  getEventStats,
  allocateEventSupplies,
  returnEventSupplies,
  markSuppliesDelivered,
} = require('../controllers/eventController');

const { authenticate } = require('../middleware/authMiddleware');
const { checkPermission } = require('../middleware/permissionMiddleware');
const validateRequest = require('../middleware/validateRequest');

const {
  createEventValidator,
  updateEventValidator,
  getEventValidator,
  listEventsValidator,
} = require('../validators/eventValidator');

const router = express.Router();

// =============================================================================
// GLOBAL MIDDLEWARE
// =============================================================================
router.use(authenticate);

// =============================================================================
// STATIC & SPECIALIZED ROUTES (Must come before /:id)
// =============================================================================

// 1. Statistics
router.get(
  "/stats", 
  checkPermission("events.read.all"), 
  getEventStats
);

// 2. Events by Client
router.get(
  "/client/:clientId", 
  checkPermission("events.read.all"),
  getEventsByClient
);

// =============================================================================
// SUPPLY MANAGEMENT (Sub-resources of Event)
// =============================================================================

router.post(
  "/:id/supplies/allocate",
  checkPermission("events.update.all"),
  getEventValidator, // Validates :id
  validateRequest,
  allocateEventSupplies
);

router.post(
  "/:id/supplies/return",
  checkPermission("events.update.all"),
  getEventValidator,
  validateRequest,
  returnEventSupplies
);

router.patch(
  "/:id/supplies/delivered",
  checkPermission("events.update.all"),
  getEventValidator,
  validateRequest,
  markSuppliesDelivered
);

// =============================================================================
// RESTORE ARCHIVED
// =============================================================================
router.patch(
  "/:id/restore",
  checkPermission("events.delete.all"),
  getEventValidator,
  validateRequest,
  restoreEvent
);

// =============================================================================
// MAIN CRUD ROUTES
// =============================================================================

router
  .route("/")
  .get(
    checkPermission("events.read.all"),
    listEventsValidator,
    validateRequest,
    getEvents
  )
  .post(
    checkPermission("events.create"),
    createEventValidator,
    validateRequest,
    createEvent
  );

router
  .route("/:id")
  .get(
    checkPermission("events.read.all"),
    getEventValidator,
    validateRequest,
    getEvent
  )
  .put(
    checkPermission("events.update.all"),
    updateEventValidator,
    validateRequest,
    updateEvent
  )
  .delete(
    checkPermission("events.delete.all"),
    getEventValidator,
    validateRequest,
    archiveEvent
  );

module.exports = router;