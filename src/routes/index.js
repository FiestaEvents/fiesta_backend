import express from "express";
import authRoutes from "./auth.routes.js";
import eventRoutes from "./event.routes.js";
import clientRoutes from "./client.routes.js";
import partnerRoutes from "./partner.routes.js";
import paymentRoutes from "./payment.routes.js";
import financeRoutes from "./finance.routes.js";
import taskRoutes from "./task.routes.js";
import reminderRoutes from "./reminder.routes.js";
import roleRoutes from "./role.routes.js";
import teamRoutes from "./team.routes.js";
import venueRoutes from "./venue.routes.js";

const router = express.Router();

// Mount routes
router.use("/auth", authRoutes);
router.use("/events", eventRoutes);
router.use("/clients", clientRoutes);
router.use("/partners", partnerRoutes);
router.use("/payments", paymentRoutes);
router.use("/finance", financeRoutes);
router.use("/tasks", taskRoutes);
router.use("/reminders", reminderRoutes);
router.use("/roles", roleRoutes);
router.use("/team", teamRoutes);
router.use("/venues", venueRoutes);

export default router;