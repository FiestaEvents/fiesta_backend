import express from "express";
import cors from "cors";
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";
import compression from "compression";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";
import config from "./config/env.js";
import errorHandler from "./middleware/errorHandler.js";
import routes from "./routes/index.js";

const app = express();

// Helper for __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Security middleware (Allow images to load across origins)
app.use(helmet({
  crossOriginResourcePolicy: false,
}));

// =========================================================
// 1. FIXED CORS CONFIGURATION (DO NOT REVERT THIS)
// =========================================================
app.use(
  cors({
    origin: [
      config.frontend.url,      // Your .env URL
      "http://localhost:3000",  // React Default
      "http://localhost:5173"   // Vite Default
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    // This allows the browser to send the data without blocking
    allowedHeaders: ["Content-Type", "Authorization", "x-venue-id"] 
  })
);

// Body parser middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Data sanitization against NoSQL injection
app.use(mongoSanitize());

// Compression middleware
app.use(compression());

// Logging middleware
if (config.env === "development") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

// Serve Static Files (Uploaded Images)
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api", limiter);

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({ success: true, message: "Server is running" });
});

// API routes
app.use("/api/v1", routes);

// Welcome route
app.get("/", (req, res) => {
  res.json({ success: true, message: "Venue Management API" });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// Global error handler
app.use(errorHandler);

export default app;