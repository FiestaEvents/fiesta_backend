// backend/routes/debug.routes.js
import express from "express";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// 1. Test Route WITHOUT Middleware (Is the Router working?)
router.get("/ping", (req, res) => {
  console.log("✅ DEBUG: /ping hit");
  res.json({ message: "Pong! Router is working." });
});

// 2. Test Route WITH Middleware (Is Auth working?)
router.get("/auth-check", protect, (req, res) => {
  console.log("✅ DEBUG: /auth-check hit. User:", req.user?._id);
  res.json({ 
    message: "Auth is working.", 
    user: req.user?._id,
    venue: req.user?.venueId 
  });
});

export default router;