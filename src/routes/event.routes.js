import express from "express";
import {
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
} from "../controllers/eventController.js";
import { authenticate } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";
import validateRequest from "../middleware/validateRequest.js";
import {
  createEventValidator,
  updateEventValidator,
  getEventValidator, // Used for ID validation
  listEventsValidator,
} from "../validators/eventValidator.js";

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
  "/client/:clientId", // Changed path slightly for clarity (/api/v1/events/client/:id)
  checkPermission("events.read.all"),
  // Assuming you might want to validate clientId here, 
  // otherwise Mongoose will throw if invalid ID
  getEventsByClient
);

// =============================================================================
// SUPPLY MANAGEMENT (Sub-resources of Event)
// =============================================================================
// These modify the event, so they require update permissions

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
  checkPermission("events.delete.all"), // Restoration usually requires delete privs
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

export default router;