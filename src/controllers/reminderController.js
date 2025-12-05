import asyncHandler from "../middleware/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { Reminder } from "../models/index.js";

/**
 * @desc    Get reminders (Simple List)
 * @route   GET /api/v1/reminders
 */
/**
 * @desc    Get reminders with filters and pagination
 * @route   GET /api/v1/reminders
 */
export const getReminders = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status = "active", 
    type,
    priority,
    startDate,
    endDate,
    search
  } = req.query;

  // 1. Base Query
  const query = {
    venueId: req.user.venueId,
    isArchived: false,
  };

  // 2. Apply Filters
  
  // Status: allow 'all' to show active + completed, otherwise filter by specific status
  if (status && status !== "all") {
    query.status = status;
  }

  // Type: allow 'all', otherwise filter specific type
  if (type && type !== "all") {
    query.type = type;
  }

  // Priority: allow 'all', otherwise filter specific priority
  if (priority && priority !== "all") {
    query.priority = priority;
  }

  // Search (by Title)
  if (search) {
    query.title = { $regex: search, $options: "i" };
  }

  // Date Range Filter
  if (startDate || endDate) {
    query.reminderDate = {};
    if (startDate) query.reminderDate.$gte = new Date(startDate);
    if (endDate) query.reminderDate.$lte = new Date(endDate);
  }

  // 3. Pagination Setup
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const skip = (pageNum - 1) * limitNum;

  // 4. Execute Query
  const [reminders, total] = await Promise.all([
    Reminder.find(query)
      .sort({ reminderDate: 1, reminderTime: 1 }) // Earliest due date first
      .skip(skip)
      .limit(limitNum)
      // Populate related data for the UI
      .populate("relatedEvent", "title startDate")
      .populate("relatedClient", "name company")
      .populate("assignedTo", "name avatar"),
    Reminder.countDocuments(query),
  ]);

  // 5. Response
  new ApiResponse({
    reminders,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum),
    },
  }).send(res);
});

/**
 * @desc    Get Upcoming / Due Reminders (For Notification Badge)
 * @route   GET /api/v1/reminders/upcoming
 */
export const getUpcomingReminders = asyncHandler(async (req, res) => {
  // 1. Get Start of Today (00:00) so we don't miss tasks due later today
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const reminders = await Reminder.find({
    venueId: req.user.venueId,
    status: "active",
    isArchived: false,
    // Fetch EVERYTHING in the future (from today onwards)
    reminderDate: { $gte: startOfToday } 
  })
  .sort({ reminderDate: 1, reminderTime: 1 }) // Sort by soonest first
  .limit(100); // Fetch enough to cover the next few years

  new ApiResponse({ reminders }).send(res);
});

/**
 * @desc    Create Reminder
 * @route   POST /api/v1/reminders
 */
export const createReminder = asyncHandler(async (req, res) => {
  const reminder = await Reminder.create({
    ...req.body,
    venueId: req.user.venueId,
    createdBy: req.user._id,
    status: "active",
    isArchived: false
  });

  new ApiResponse({ reminder }, "Reminder created", 201).send(res);
});

/**
 * @desc    Toggle Completion Status
 * @route   PATCH /api/v1/reminders/:id/toggle-complete
 */
export const toggleComplete = asyncHandler(async (req, res) => {
  const reminder = await Reminder.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  });

  if (!reminder) throw new ApiError("Reminder not found", 404);

  // Simple toggle
  reminder.status = reminder.status === "active" ? "completed" : "active";
  await reminder.save();

  new ApiResponse({ reminder }, 
    reminder.status === "completed" ? "Task completed" : "Task reactivated"
  ).send(res);
});

/**
 * @desc    Delete (Archive) Reminder
 * @route   DELETE /api/v1/reminders/:id
 */
export const deleteReminder = asyncHandler(async (req, res) => {
  const reminder = await Reminder.findOneAndUpdate(
    { _id: req.params.id, venueId: req.user.venueId },
    { isArchived: true, archivedAt: new Date() },
    { new: true }
  );

  if (!reminder) throw new ApiError("Reminder not found", 404);

  new ApiResponse(null, "Reminder deleted").send(res);
});

/**
 * @desc    Get Single Reminder
 * @route   GET /api/v1/reminders/:id
 */
export const getReminder = asyncHandler(async (req, res) => {
  const reminder = await Reminder.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
  });
  if (!reminder) throw new ApiError("Not found", 404);
  new ApiResponse({ reminder }).send(res);
});

/**
 * @desc    Update Reminder
 * @route   PUT /api/v1/reminders/:id
 */
export const updateReminder = asyncHandler(async (req, res) => {
  const reminder = await Reminder.findOneAndUpdate(
    { _id: req.params.id, venueId: req.user.venueId },
    req.body,
    { new: true, runValidators: true }
  );
  if (!reminder) throw new ApiError("Not found", 404);
  new ApiResponse({ reminder }, "Updated").send(res);
});