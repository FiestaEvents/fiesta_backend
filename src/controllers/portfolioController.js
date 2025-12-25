import asyncHandler from "../middleware/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import Portfolio from "../models/Portfolio.js";

/**
 * @desc    Get all portfolio projects
 * @route   GET /api/v1/portfolio
 */
export const getProjects = asyncHandler(async (req, res) => {
  // Safety check: Ensure user belongs to a business
  if (!req.business || !req.business._id) {
    // If not a business user (e.g. Super Admin or broken account), return empty or throw error
    // For now, return empty list to prevent crash
    return new ApiResponse({ projects: [], pagination: {} }).send(res);
  }

  const { category, search, page = 1, limit = 12 } = req.query;
  const query = { businessId: req.business._id, isArchived: false };

  if (category && category !== 'All') query.category = category;
  if (search) query.title = { $regex: search, $options: 'i' };

  const projects = await Portfolio.find(query)
    .sort({ date: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  const total = await Portfolio.countDocuments(query);

  new ApiResponse({ 
    projects,
    pagination: {
      page: parseInt(page),
      total,
      pages: Math.ceil(total / limit)
    }
  }).send(res);
});

/**
 * @desc    Create a new project
 * @route   POST /api/v1/portfolio
 */
export const createProject = asyncHandler(async (req, res) => {
  // ✅ FIX: Check if business context exists
  if (!req.business || !req.business._id) {
    throw new ApiError("User is not linked to a Business. Cannot create project.", 400);
  }

  const project = await Portfolio.create({
    ...req.body,
    businessId: req.business._id, // This was causing the crash
    createdBy: req.user._id
  });

  new ApiResponse({ project }, "Project created successfully", 201).send(res);
});

/**
 * @desc    Get single project details
 * @route   GET /api/v1/portfolio/:id
 */
export const getProject = asyncHandler(async (req, res) => {
  if (!req.business || !req.business._id) {
    throw new ApiError("Business context required", 400);
  }

  const project = await Portfolio.findOne({
    _id: req.params.id,
    businessId: req.business._id
  });

  if (!project) throw new ApiError("Project not found", 404);

  new ApiResponse({ project }).send(res);
});

/**
 * @desc    Update project (Add images, change title)
 * @route   PUT /api/v1/portfolio/:id
 */
export const updateProject = asyncHandler(async (req, res) => {
  if (!req.business || !req.business._id) {
    throw new ApiError("Business context required", 400);
  }

  const project = await Portfolio.findOneAndUpdate(
    { _id: req.params.id, businessId: req.business._id },
    req.body,
    { new: true, runValidators: true }
  );

  if (!project) throw new ApiError("Project not found", 404);

  new ApiResponse({ project }, "Project updated").send(res);
});

/**
 * @desc    Delete project
 * @route   DELETE /api/v1/portfolio/:id
 */
export const deleteProject = asyncHandler(async (req, res) => {
  if (!req.business || !req.business._id) {
    throw new ApiError("Business context required", 400);
  }

  const project = await Portfolio.findOne({
    _id: req.params.id,
    businessId: req.business._id
  });

  if (!project) throw new ApiError("Project not found", 404);

  await project.deleteOne();
  new ApiResponse(null, "Project deleted").send(res);
});