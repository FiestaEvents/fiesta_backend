import asyncHandler from "../middleware/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { Reminder, Event, Client, Task, Payment, User } from "../models/index.js";

/**
 * @desc    Get all reminders
 * @route   GET /api/v1/reminders
 * @access  Private
 */
export const getReminders = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    type,
    priority,
    status,
    startDate,
    endDate,
  } = req.query;

  // Build query
  const query = { venueId: req.user.venueId };

  if (type) query.type = type;
  if (priority) query.priority = priority;
  if (status) query.status = status;

  // Date range filter
  if (startDate || endDate) {
    query.reminderDate = {};
    if (startDate) query.reminderDate.$gte = new Date(startDate);
    if (endDate) query.reminderDate.$lte = new Date(endDate);
  }

  // Pagination
  const skip = (page - 1) * limit;

  // Execute query
  const [reminders, total] = await Promise.all([
    Reminder.find(query)
      .populate("assignedTo", "name email avatar")
      .populate("relatedEvent", "title startDate")
      .populate("relatedClient", "name email")
      .populate("relatedTask", "title status")
      .populate("relatedPayment", "amount status")
      .populate("createdBy", "name email")
      .sort({ reminderDate: 1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Reminder.countDocuments(query),
  ]);

  new ApiResponse({
    reminders,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit),
    },
  }).send(res);
});

/**
 * @desc    Get single reminder
 * @route   GET /api/v1/reminders/:id
 * @access  Private
 */
export const getReminder = asyncHandler(async (req, res) => {
  const reminder = await Reminder.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  })
    .populate("assignedTo", "name email avatar")
    .populate("relatedEvent")
    .populate("relatedClient")
    .populate("relatedTask")
    .populate("relatedPayment")
    .populate("createdBy", "name email");

  if (!reminder) {
    throw new ApiError("Reminder not found", 404);
  }

  new ApiResponse({ reminder }).send(res);
});

/**
 * @desc    Create new reminder
 * @route   POST /api/v1/reminders
 * @access  Private (reminders.create)
 */
export const createReminder = asyncHandler(async (req, res) => {
  const reminderData = {
    ...req.body,
    venueId: req.user.venueId,
    createdBy: req.user._id,
  };

  // Verify assigned users exist and belong to venue
  if (reminderData.assignedTo && reminderData.assignedTo.length > 0) {
    const users = await User.find({
      _id: { $in: reminderData.assignedTo },
      venueId: req.user.venueId,
    });

    if (users.length !== reminderData.assignedTo.length) {
      throw new ApiError("Some assigned users not found", 404);
    }
  }

  // Verify related resources if provided
  if (reminderData.relatedEvent) {
    const event = await Event.findOne({
      _id: reminderData.relatedEvent,
      venueId: req.user.venueId,
    });
    if (!event) throw new ApiError("Event not found", 404);
  }

  if (reminderData.relatedClient) {
    const client = await Client.findOne({
      _id: reminderData.relatedClient,
      venueId: req.user.venueId,
    });
    if (!client) throw new ApiError("Client not found", 404);
  }

  if (reminderData.relatedTask) {
    const task = await Task.findOne({
      _id: reminderData.relatedTask,
      venueId: req.user.venueId,
    });
    if (!task) throw new ApiError("Task not found", 404);
  }

  if (reminderData.relatedPayment) {
    const payment = await Payment.findOne({
      _id: reminderData.relatedPayment,
      venueId: req.user.venueId,
    });
    if (!payment) throw new ApiError("Payment not found", 404);
  }

  const reminder = await Reminder.create(reminderData);

  await reminder.populate([
    { path: "assignedTo", select: "name email avatar" },
    { path: "relatedEvent", select: "title startDate" },
  ]);

  new ApiResponse({ reminder }, "Reminder created successfully", 201).send(res);
});

/**
 * @desc    Update reminder
 * @route   PUT /api/v1/reminders/:id
 * @access  Private (reminders.update.all)
 */
export const updateReminder = asyncHandler(async (req, res) => {
  const reminder = await Reminder.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  });

  if (!reminder) {
    throw new ApiError("Reminder not found", 404);
  }

  // If status is being changed to completed, set completedAt and completedBy
  if (req.body.status === "completed" && reminder.status !== "completed") {
    req.body.completedAt = new Date();
    req.body.completedBy = req.user._id;
  }

  Object.assign(reminder, req.body);
  await reminder.save();

  await reminder.populate([
    { path: "assignedTo", select: "name email avatar" },
    { path: "relatedEvent", select: "title startDate" },
  ]);

  new ApiResponse({ reminder }, "Reminder updated successfully").send(res);
});

/**
 * @desc    Delete reminder
 * @route   DELETE /api/v1/reminders/:id
 * @access  Private (reminders.delete.all)
 */
export const deleteReminder = asyncHandler(async (req, res) => {
  const reminder = await Reminder.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  });

  if (!reminder) {
    throw new ApiError("Reminder not found", 404);
  }

  await reminder.deleteOne();

  new ApiResponse(null, "Reminder deleted successfully").send(res);
});

/**
 * @desc    Snooze reminder
 * @route   POST /api/v1/reminders/:id/snooze
 * @access  Private
 */
export const snoozeReminder = asyncHandler(async (req, res) => {
  const { snoozeUntil } = req.body;

  const reminder = await Reminder.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  });

  if (!reminder) {
    throw new ApiError("Reminder not found", 404);
  }

  reminder.status = "snoozed";
  reminder.snoozeUntil = new Date(snoozeUntil);

  await reminder.save();

  new ApiResponse({ reminder }, "Reminder snoozed successfully").send(res);
});

/**
 * @desc    Get upcoming reminders
 * @route   GET /api/v1/reminders/upcoming
 * @access  Private
 */
export const getUpcomingReminders = asyncHandler(async (req, res) => {
  const { days = 7 } = req.query;

  const endDate = new Date();
  endDate.setDate(endDate.getDate() + parseInt(days));

  const reminders = await Reminder.find({
    venueId: req.user.venueId,
    status: "active",
    reminderDate: {
      $gte: new Date(),
      $lte: endDate,
    },
  })
    .populate("assignedTo", "name email avatar")
    .populate("relatedEvent", "title startDate")
    .sort({ reminderDate: 1 })
    .limit(20);

  new ApiResponse({ reminders }).send(res);
});