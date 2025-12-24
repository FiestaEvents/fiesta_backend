import asyncHandler from "../middleware/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { User, Business } from "../models/index.js";

/**
 * @desc    Get All Businesses (with Owners)
 * @route   GET /api/v1/admin/businesses
 */
export const getAllBusinesses = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search } = req.query;
  
  const query = {};
  if (search) {
    query.name = { $regex: search, $options: "i" };
  }

  const businesses = await Business.find(query)
    .populate("owner", "name email phone isActive")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  const total = await Business.countDocuments(query);

  new ApiResponse({ businesses, pagination: { total, page, limit } }).send(res);
});

/**
 * @desc    Get All Users (System Wide)
 * @route   GET /api/v1/admin/users
 */
export const getAllUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search } = req.query;
  
  const query = { isSuperAdmin: false }; // Don't list other admins
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } }
    ];
  }

  const users = await User.find(query)
    .populate("businessId", "name")
    .select("-password")
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  const total = await User.countDocuments(query);

  new ApiResponse({ users, pagination: { total, page, limit } }).send(res);
});

/**
 * @desc    Manage Subscription (Upgrade/Downgrade/Suspend)
 * @route   PATCH /api/v1/admin/business/:id/subscription
 */
export const manageSubscription = asyncHandler(async (req, res) => {
  const { plan, status, endDate } = req.body;
  const { id } = req.params;

  const business = await Business.findById(id);
  if (!business) throw new ApiError("Business not found", 404);

  if (plan) business.subscription.plan = plan;
  if (status) business.subscription.status = status;
  if (endDate) business.subscription.endDate = new Date(endDate);

  await business.save();

  new ApiResponse({ business }, "Subscription updated successfully").send(res);
});

/**
 * @desc    Admin User Management (Ban/Reset Password)
 * @route   PATCH /api/v1/admin/users/:id
 */
export const manageUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isActive, newPassword, email } = req.body;

  const user = await User.findById(id);
  if (!user) throw new ApiError("User not found", 404);

  // 1. Ban/Unban
  if (typeof isActive !== 'undefined') {
    user.isActive = isActive;
  }

  // 2. Force Change Email
  if (email) {
    const exists = await User.findOne({ email });
    if (exists && exists._id.toString() !== id) {
      throw new ApiError("Email already in use", 400);
    }
    user.email = email;
  }

  // 3. Force Reset Password
  if (newPassword) {
    user.password = newPassword; // Pre-save hook will hash it
  }

  await user.save();

  new ApiResponse({ id: user._id, status: user.isActive ? "Active" : "Banned" }, "User updated successfully").send(res);
});