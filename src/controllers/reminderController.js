// controllers/reminderController.js - IMPROVED VERSION
import asyncHandler from "../middleware/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { Reminder } from "../models/index.js";

// ==========================================
// @desc    Get reminders with filters and pagination
// @route   GET /api/v1/reminders
// @access  Private
// ==========================================
export const getReminders = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status, 
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
  if (status && status !== "all") {
    query.status = status;
  }

  if (type && type !== "all") {
    query.type = type;
  }

  if (priority && priority !== "all") {
    query.priority = priority;
  }

  if (search) {
    query.$or = [
      { title: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } }
    ];
  }

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
      .sort({ reminderDate: 1, reminderTime: 1 })
      .skip(skip)
      .limit(limitNum)
      .populate("relatedEvent", "title startDate")
      .populate("relatedClient", "name company")
      .populate("assignedTo", "name avatar")
      .lean(), // ✅ Use lean for better performance
    Reminder.countDocuments(query),
  ]);

  // 5. Response
  res.status(200).json({
    success: true,
    data: {
      reminders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    },
  });
});

// ==========================================
// @desc    Get single reminder
// @route   GET /api/v1/reminders/:id
// @access  Private
// ==========================================
export const getReminder = asyncHandler(async (req, res) => {
  const reminder = await Reminder.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
    isArchived: false,
  })
    .populate("relatedEvent", "title startDate")
    .populate("relatedClient", "name company")
    .populate("assignedTo", "name avatar")
    .populate("createdBy", "name");

  if (!reminder) {
    throw new ApiError("Reminder not found", 404);
  }

  res.status(200).json({
    success: true,
    data: { reminder },
  });
});

// ==========================================
// @desc    Create reminder
// @route   POST /api/v1/reminders
// @access  Private
// ==========================================
export const createReminder = asyncHandler(async (req, res) => {
  const reminder = await Reminder.create({
    ...req.body,
    venueId: req.user.venueId,
    createdBy: req.user._id,
    status: "active",
    isArchived: false,
    dismissed: false
  });

  res.status(201).json({
    success: true,
    message: "Reminder created successfully",
    data: { reminder },
  });
});

// ==========================================
// @desc    Update reminder
// @route   PUT /api/v1/reminders/:id
// @access  Private
// ==========================================
export const updateReminder = asyncHandler(async (req, res) => {
  const reminder = await Reminder.findOneAndUpdate(
    { _id: req.params.id, venueId: req.user.venueId, isArchived: false },
    req.body,
    { new: true, runValidators: true }
  );

  if (!reminder) {
    throw new ApiError("Reminder not found", 404);
  }

  res.status(200).json({
    success: true,
    message: "Reminder updated successfully",
    data: { reminder },
  });
});

// ==========================================
// @desc    Delete (archive) reminder
// @route   DELETE /api/v1/reminders/:id
// @access  Private
// ==========================================
export const deleteReminder = asyncHandler(async (req, res) => {
  const reminder = await Reminder.findOneAndUpdate(
    { _id: req.params.id, venueId: req.user.venueId },
    { isArchived: true, archivedAt: new Date() },
    { new: true }
  );

  if (!reminder) {
    throw new ApiError("Reminder not found", 404);
  }

  res.status(200).json({
    success: true,
    message: "Reminder deleted successfully",
  });
});

// ==========================================
// @desc    Toggle completion status
// @route   PATCH /api/v1/reminders/:id/toggle-complete
// @access  Private
// ==========================================
export const toggleComplete = asyncHandler(async (req, res) => {
  const reminder = await Reminder.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
    isArchived: false,
  });

  if (!reminder) {
    throw new ApiError("Reminder not found", 404);
  }

  reminder.status = reminder.status === "active" ? "completed" : "active";
  await reminder.save();

  res.status(200).json({
    success: true,
    message: reminder.status === "completed" ? "Task completed" : "Task reactivated",
    data: { reminder },
  });
});

// ==========================================
// @desc    Snooze reminder
// @route   POST /api/v1/reminders/:id/snooze
// @access  Private
// ==========================================
export const snoozeReminder = asyncHandler(async (req, res) => {
  const { minutes = 15 } = req.body;
  const { id } = req.params;
  
  // ✅ Validate minutes
  if (minutes < 5 || minutes > 1440) {
    throw new ApiError('Snooze duration must be between 5 minutes and 24 hours', 400);
  }

  const reminder = await Reminder.findOne({ 
    _id: id, 
    venueId: req.user.venueId,
    isArchived: false
  });
  
  if (!reminder) {
    throw new ApiError('Reminder not found', 404);
  }

  // ✅ Calculate new reminder time
  const now = new Date();
  const newReminderDateTime = new Date(now.getTime() + minutes * 60 * 1000);
  
  // ✅ Update reminder date and time
  reminder.reminderDate = newReminderDateTime;
  reminder.reminderTime = `${String(newReminderDateTime.getHours()).padStart(2, '0')}:${String(newReminderDateTime.getMinutes()).padStart(2, '0')}`;
  
  // ✅ Add to snooze history
  if (!reminder.snoozeHistory) {
    reminder.snoozeHistory = [];
  }
  reminder.snoozeHistory.push({
    snoozedAt: now,
    snoozeMinutes: minutes,
    snoozedBy: req.user._id
  });
  
  await reminder.save();

  res.status(200).json({
    success: true,
    message: `Reminder snoozed for ${minutes} minutes`,
    data: { reminder }
  });
});

// ==========================================
// @desc    Get upcoming reminders
// @route   GET /api/v1/reminders/upcoming
// @access  Private
// ==========================================
export const getUpcomingReminders = asyncHandler(async (req, res) => {
  const hours = parseInt(req.query.hours) || 168; // Default 7 days
  
  // ✅ Validate hours parameter
  if (hours < 0 || hours > 720) {
    throw new ApiError('Hours parameter must be between 0 and 720', 400);
  }
  
  const now = new Date();
  const futureDate = new Date(now.getTime() + hours * 60 * 60 * 1000);
  const pastDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24h ago

  // ✅ Query with proper fields
  const reminders = await Reminder.find({
    venueId: req.user.venueId,
    isArchived: false,
    dismissed: false, // ✅ Exclude dismissed reminders
    status: 'active',
    reminderDate: {
      $gte: pastDate,
      $lte: futureDate
    }
  })
  .select('title description reminderDate reminderTime type priority relatedEvent relatedClient')
  .populate('relatedEvent', 'title startDate')
  .populate('relatedClient', 'name')
  .sort({ reminderDate: 1, reminderTime: 1 })
  .limit(100) // ✅ Increased limit
  .lean(); // ✅ Use lean for better performance

  // ✅ Pre-calculate stats
  const stats = {
    total: reminders.length,
    overdue: 0,
    today: 0,
    upcoming: 0
  };

  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  reminders.forEach(reminder => {
    try {
      const [year, month, day] = reminder.reminderDate.toISOString().split('T')[0].split('-').map(Number);
      const [hours, minutes] = reminder.reminderTime.split(':').map(Number);
      const reminderDateTime = new Date(year, month - 1, day, hours, minutes);
      
      if (reminderDateTime < now) {
        stats.overdue++;
      } else if (reminderDateTime <= todayEnd) {
        stats.today++;
      } else {
        stats.upcoming++;
      }
    } catch (e) {
      console.error('Error processing reminder date:', e);
    }
  });

  res.status(200).json({
    success: true,
    data: {
      reminders,
      count: reminders.length,
      stats,
      fetchedAt: now.toISOString()
    }
  });
});

// ==========================================
// @desc    Dismiss a reminder
// @route   POST /api/v1/reminders/:id/dismiss
// @access  Private
// ==========================================
export const dismissReminder = asyncHandler(async (req, res) => {
  const reminder = await Reminder.findOne({
    _id: req.params.id,
    venueId: req.user.venueId,
    isArchived: false,
  });

  if (!reminder) {
    throw new ApiError("Reminder not found", 404);
  }

  reminder.dismissed = true;
  reminder.dismissedAt = new Date();
  reminder.dismissedBy = req.user._id;

  await reminder.save();

  res.status(200).json({
    success: true,
    message: "Reminder dismissed",
    data: { reminder },
  });
});

// ==========================================
// @desc    Get reminder statistics
// @route   GET /api/v1/reminders/stats
// @access  Private
// ==========================================
export const getReminderStats = asyncHandler(async (req, res) => {
  const venueId = req.user.venueId;
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const [overdue, today, upcoming, total] = await Promise.all([
    // Overdue
    Reminder.countDocuments({
      venueId,
      isArchived: false,
      dismissed: false,
      status: 'active',
      reminderDate: { $lt: todayStart }
    }),
    
    // Today
    Reminder.countDocuments({
      venueId,
      isArchived: false,
      dismissed: false,
      status: 'active',
      reminderDate: {
        $gte: todayStart,
        $lte: todayEnd
      }
    }),
    
    // Upcoming (next 7 days)
    Reminder.countDocuments({
      venueId,
      isArchived: false,
      dismissed: false,
      status: 'active',
      reminderDate: {
        $gt: todayEnd,
        $lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      }
    }),
    
    // Total active
    Reminder.countDocuments({
      venueId,
      isArchived: false,
      dismissed: false,
      status: 'active'
    })
  ]);

  res.status(200).json({
    success: true,
    data: {
      overdue,
      today,
      upcoming,
      total,
      fetchedAt: now.toISOString()
    }
  });
});