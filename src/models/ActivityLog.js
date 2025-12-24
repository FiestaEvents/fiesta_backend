// src/models/ActivityLog.js
const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  action: {
    type: String,
    required: true, 
  },
  details: {
    type: String, 
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed, 
    default: {}
  },
  
  // =========================================================
  // ARCHITECTURE UPDATE: Linked to Generic Business
  // =========================================================
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Business",
    required: true,
  },
  
  // Security Auditing
  ipAddress: {
    type: String
  },
  
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

// Index for efficiently fetching "Recent Activity" feeds on dashboards
activityLogSchema.index({ businessId: 1, timestamp: -1 });

module.exports = mongoose.model("ActivityLog", activityLogSchema);