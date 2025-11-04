import app from "./app.js";
import config from "./config/env.js";
import connectDB from "./config/database.js";

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("❌ UNCAUGHT EXCEPTION! Shutting down...");
  console.error(err.name, err.message);
  process.exit(1);
});

// Connect to database
connectDB();

// Start server
const server = app.listen(config.port, () => {
  console.log(`
  ╔═══════════════════════════════════════════════════════╗
  ║                                                       ║
  ║   🎉  Venue Management API Server                     ║
  ║                                                       ║
  ║   🚀  Server running on port ${config.port}                   ║
  ║   🌍  Environment: ${config.env.toUpperCase().padEnd(11)}      ║
  ║   📡  API URL: http://localhost:${config.port}/api/v1         ║
  ║   💚  Status: Ready to accept requests                ║
  ║                                                       ║
  ╚═══════════════════════════════════════════════════════╝
  `);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  console.error("❌ UNHANDLED REJECTION! Shutting down...");
  console.error(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

// Handle SIGTERM
process.on("SIGTERM", () => {
  console.log("👋 SIGTERM RECEIVED. Shutting down gracefully...");
  server.close(() => {
    console.log("💤 Process terminated!");
  });
});