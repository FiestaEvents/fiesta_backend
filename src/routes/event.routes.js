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
  getEventValidator,
  listEventsValidator,
} from "../validators/eventValidator.js";

const router = express.Router();

// =============================================================================
// GLOBAL MIDDLEWARE
// =============================================================================
// All event routes require the user to be logged in
router.use(authenticate);

// =============================================================================
// SPECIALIZED ROUTES (Must come before /:id)
// =============================================================================

// 1. Statistics
router.get("/stats", checkPermission("events.read.all"), getEventStats);

// 2. Events by Client
router.get(
  "/client/:clientId",
  checkPermission("events.read.all"),
  getEventsByClient
);

// 3. Restore Archived Event
// Uses PATCH because it's a partial update to status
router.patch(
  "/:id/restore",
  checkPermission("events.delete.all"),
  restoreEvent
);

// =============================================================================
// CRUD ROUTES
// =============================================================================

router
  .route("/")
  /**
   * @route   GET /api/v1/events
   * @desc    Get all events (supports filtering & ?includeArchived=true)
   */
  .get(
    checkPermission("events.read.all"),
    listEventsValidator,
    validateRequest,
    getEvents
  )

  /**
   * @route   POST /api/v1/events
   * @desc    Create a new event
   */
  .post(
    checkPermission("events.create"),
    createEventValidator,
    validateRequest,
    createEvent
  );

router
  .route("/:id")
  /**
   * @route   GET /api/v1/events/:id
   * @desc    Get single event details
   */
  .get(
    checkPermission("events.read.all"),
    getEventValidator,
    validateRequest,
    getEvent
  )

  /**
   * @route   PUT /api/v1/events/:id
   * @desc    Update an event
   */
  .put(
    checkPermission("events.update.all"),
    updateEventValidator,
    validateRequest,
    updateEvent
  )

  /**
   * @route   DELETE /api/v1/events/:id
   * @desc    Archive (Soft Delete) an event
   */
  .delete(
    checkPermission("events.delete.all"),
    getEventValidator, // Ensures ID is valid MongoID
    validateRequest,
    archiveEvent
  );
//  Add supply management endpoints
router.post("/:id/supplies/allocate", allocateEventSupplies);
router.post("/:id/supplies/return", returnEventSupplies);
router.patch("/:id/supplies/delivered", markSuppliesDelivered);
export default router;
