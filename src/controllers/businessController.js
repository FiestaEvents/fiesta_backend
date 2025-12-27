import mongoose from "mongoose";
import asyncHandler from "../middleware/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { Business, Space } from "../models/index.js";

// Helper
const getBusinessId = (req) => {
  const id = req.business?._id || req.user?.businessId;
  return id ? id.toString() : null;
};

// ==========================================
// BUSINESS PROFILE
// ==========================================

/**
 * @desc    Get current business details
 * @route   GET /api/v1/business/me
 */
export const getMyBusiness = asyncHandler(async (req, res) => {
  const businessId = getBusinessId(req);
  if (!businessId) throw new ApiError("User not linked to business", 403);

  const business = await Business.findById(businessId).populate(
    "owner",
    "name email"
  );
  if (!business) throw new ApiError("Business not found", 404);

  // Return structure matching frontend expectations
  new ApiResponse({
    business,
    // Legacy support if frontend expects 'venue'
    venue: business,
  }).send(res);
});

/**
 * @desc    Update business details
 * @route   PUT /api/v1/business/me
 */
export const updateBusiness = asyncHandler(async (req, res) => {
  const businessId = getBusinessId(req);

  // Protect sensitive fields
  delete req.body._id;
  delete req.body.owner;
  delete req.body.subscription;

  const business = await Business.findByIdAndUpdate(businessId, req.body, {
    new: true,
    runValidators: true,
  });

  if (!business) throw new ApiError("Business not found", 404);

  new ApiResponse({ business }, "Business profile updated successfully").send(
    res
  );
});

// ==========================================
// RESOURCES (SPACES) MANAGEMENT
// ==========================================

/**
 * @desc    Get all resources (spaces)
 * @route   GET /api/v1/business/resources
 */
export const getResources = asyncHandler(async (req, res) => {
  const businessId = getBusinessId(req);

  const spaces = await Space.find({
    businessId,
    isArchived: false,
  }).sort({ createdAt: -1 });

  new ApiResponse({ spaces }).send(res);
});

/**
 * @desc    Create a resource
 * @route   POST /api/v1/business/resources
 */
export const createResource = asyncHandler(async (req, res) => {
  const businessId = getBusinessId(req);

  const space = await Space.create({
    ...req.body,
    businessId,
    owner: req.user._id,
  });

  // Update Business Link if needed (optional, depending on schema)
  await Business.findByIdAndUpdate(businessId, {
    $push: { "venueDetails.spaces": space._id },
  });

  new ApiResponse({ space }, "Resource created successfully", 201).send(res);
});

/**
 * @desc    Update a resource
 * @route   PUT /api/v1/business/resources/:id
 */
export const updateResource = asyncHandler(async (req, res) => {
  const businessId = getBusinessId(req);

  const space = await Space.findOneAndUpdate(
    { _id: req.params.id, businessId },
    req.body,
    { new: true, runValidators: true }
  );

  if (!space) throw new ApiError("Resource not found", 404);

  new ApiResponse({ space }, "Resource updated successfully").send(res);
});

/**
 * @desc    Delete (Archive) a resource
 * @route   DELETE /api/v1/business/resources/:id
 */
export const deleteResource = asyncHandler(async (req, res) => {
  const businessId = getBusinessId(req);

  const space = await Space.findOneAndUpdate(
    { _id: req.params.id, businessId },
    { isArchived: true },
    { new: true }
  );

  if (!space) throw new ApiError("Resource not found", 404);

  new ApiResponse(null, "Resource deleted successfully").send(res);
});
