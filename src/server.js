import http from "http";
import { Server } from "socket.io";
import app from "./app.js";
import config from "./config/env.js";
import connectDB from "./config/database.js";
import { initCronJobs } from "./utils/cron.service.js"; 

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("❌ UNCAUGHT EXCEPTION! Shutting down...");
  console.error(err.name, err.message);
  process.exit(1);
});

// Connect to database
connectDB();

// =========================================================
// SOCKET.IO SETUP
// =========================================================

// 1. Create the HTTP Server explicitly (wrapping Express)
const httpServer = http.createServer(app);

// 2. Initialize Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: [
      config.frontend.url,
      "http://localhost:3000",
      "http://localhost:5173"
    ],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// 3. Make 'io' global so Cron Service can use it
global.io = io;

// 4. Socket Connection Logic (Optional Debugging)
io.on("connection", (socket) => {
  console.log("⚡ Client connected via Socket:", socket.id);

  socket.on("join_room", (room) => {
    socket.join(room);
    console.log(`👤 Socket joined room: ${room}`);
  });

  socket.on("disconnect", () => {
    // console.log("❌ Client disconnected");
  });
});

// =========================================================
// START SERVER
// =========================================================

// Note: We listen on 'httpServer', NOT 'app'
const server = httpServer.listen(config.port, () => {
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
  
  // Initialize Cron Jobs AFTER server starts
  initCronJobs();
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