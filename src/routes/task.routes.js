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

// All routes require authentication
router.use(authenticate);

// Stats
router.get("/stats", checkPermission("events.read.all"), getEventStats);

// REMOVED: router.get("/archived", ...) because getEvents now handles archived items via query param

// Restore archived event
router.patch("/:id/restore", checkPermission("events.delete.all"), restoreEvent);

// Get events by client ID
router.get(
  "/client/:clientId",
  checkPermission("events.read.all"),
  getEventsByClient
);

// CRUD operations
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