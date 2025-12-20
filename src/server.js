import http from "http";
import app from "./app.js";
import config from "./config/env.js";
import connectDB from "./config/database.js";
import { agendaService } from "./services/agenda.service.js";
import { initializeSocketIO } from "./services/socket.service.js";

// =========================================================
// GLOBAL ERROR HANDLERS
// =========================================================
process.on("uncaughtException", (err) => {
  console.error("❌ UNCAUGHT EXCEPTION! Shutting down...");
  console.error(err.name, err.message);
  process.exit(1);
});

// =========================================================
// DATABASE CONNECTION
// =========================================================
await connectDB();

// =========================================================
// HTTP + SOCKET.IO SETUP
// =========================================================

// 1. Create HTTP server
const httpServer = http.createServer(app);

// 2. Initialize Socket.io (your service)
initializeSocketIO(httpServer);

// =========================================================
// START SERVER
// =========================================================
const server = httpServer.listen(config.port, async () => {
  console.log(`
  ╔═══════════════════════════════════════════════════════╗
  ║                                                       ║
  ║   🎉  Venue Management API Server                     ║
  ║                                                       ║
  ║   🚀  Server running on port ${config.port}                   ║
  ║   🌍  Environment: ${config.env.toUpperCase().padEnd(11)}      ║
  ║   📡  API URL: http://localhost:${config.port}/api/v1         ║
  ║   ⚡  Socket:  Enabled                                ║
  ║   💚  Status: Ready to accept requests                ║
  ║                                                       ║
  ╚═══════════════════════════════════════════════════════╝
  `);

  // 3. Initialize Agenda AFTER DB + Socket are ready
  await agendaService.initialize();
});

// =========================================================
// SHUTDOWN HANDLING
// =========================================================

// Unhandled promise rejections
process.on("unhandledRejection", (err) => {
  console.error("❌ UNHANDLED REJECTION! Shutting down...");
  console.error(err.name, err.message);

  server.close(async () => {
    await agendaService.stop();
    process.exit(1);
  });
});

// SIGTERM (Docker / PM2 / Railway / etc.)
process.on("SIGTERM", async () => {
  console.log("👋 SIGTERM RECEIVED. Shutting down gracefully...");

  server.close(async () => {
    await agendaService.stop();
    console.log("💤 Process terminated!");
    process.exit(0);
  });
});
