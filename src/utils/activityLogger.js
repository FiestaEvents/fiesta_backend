import { ActivityLog } from "../models/index.js";

/**
 * Log a user action
 * @param {string} userId - The ID of the user performing the action
 * @param {string} businessId - The ID of the business (formerly venueId)
 * @param {string} action - Short code (e.g., "login", "update_profile")
 * @param {string} details - Human readable details
 */
export const logActivity = async (userId, businessId, action, details) => {
  try {
    await ActivityLog.create({
      userId,
      businessId, // Linked to the generic Business entity
      action,
      details,
      timestamp: new Date()
    });
  } catch (error) {
    console.error("Failed to log activity:", error);
    // Don't throw error, just log it. Logging shouldn't break the main app flow.
  }
};