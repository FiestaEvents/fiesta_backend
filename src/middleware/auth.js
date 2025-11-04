import jwt from "jsonwebtoken";
import asyncHandler from "./asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { User } from "../models/index.js";
import config from "../config/env.js";

export const authenticate = asyncHandler(async (req, res, next) => {
  let token;

  // Get token from header
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  // Check if token exists
  if (!token) {
    throw new ApiError("Not authorized to access this route", 401);
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, config.jwt.secret);

    // Get user from token
    req.user = await User.findById(decoded.id)
      .populate("roleId")
      .populate("venueId");

    if (!req.user) {
      throw new ApiError("User not found", 404);
    }

    if (!req.user.isActive) {
      throw new ApiError("User account is inactive", 403);
    }

    next();
  } catch (error) {
    throw new ApiError("Not authorized to access this route", 401);
  }
});

// Attach venue to request
export const attachVenue = asyncHandler(async (req, res, next) => {
  if (req.user && req.user.venueId) {
    req.venue = req.user.venueId;
  }
  next();
});