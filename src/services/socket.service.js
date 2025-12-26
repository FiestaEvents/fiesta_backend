import { Server } from "socket.io";
import config from "../config/env.js";
import { logger } from "../utils/logger.js";

/**
 * Initialize and configure Socket.io
 */
export function initializeSocketIO(httpServer) {
  // Create Socket.io server
  const io = new Server(httpServer, {
    cors: {
      // ✅ FIX: Use a function to dynamically allow origins
      origin: (requestOrigin, callback) => {
        const allowedOrigins = [
          config.frontend?.url,
          "http://localhost:3000",
          "http://localhost:5173", // Vite default
          "http://127.0.0.1:5173",
          "http://127.0.0.1:3000",
        ].filter(Boolean); // Remove null/undefined

        // Allow requests with no origin (like Postman or server-to-server)
        if (!requestOrigin) return callback(null, true);

        // Check exact match
        if (allowedOrigins.includes(requestOrigin)) {
          return callback(null, true);
        }

        // Check Regex for Localhost (Development only)
        if (
          config.env === "development" ||
          process.env.NODE_ENV === "development"
        ) {
          const isLocalhost =
            /^http:\/\/localhost:\d+$/.test(requestOrigin) ||
            /^http:\/\/127\.0\.0\.1:\d+$/.test(requestOrigin);
          if (isLocalhost) {
            return callback(null, true);
          }
        }

        console.warn(`⚠️ Socket CORS blocked origin: ${requestOrigin}`);
        return callback(new Error("Not allowed by CORS"));
      },
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization"],
    },
    // ✅ Optimization: Allow both for stability
    transports: ["polling", "websocket"],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Socket.io middleware for authentication
  io.use(async (socket, next) => {
    try {
      // Placeholder: If you send token in auth object
      // const token = socket.handshake.auth?.token;
      // if (token) { ... verify ... }
      next();
    } catch (error) {
      logger.warn("Socket authentication failed:", error.message);
      next(new Error("Authentication error"));
    }
  });

  // Socket connection handling
  io.on("connection", (socket) => {
    logger.debug("⚡ Client connected via Socket:", {
      socketId: socket.id,
      origin: socket.handshake.headers.origin,
    });

    // Handle room joining
    socket.on("join_room", (room) => {
      socket.join(room);
      logger.debug(`👤 Socket ${socket.id} joined room: ${room}`);
    });

    // Handle room leaving
    socket.on("leave_room", (room) => {
      socket.leave(room);
      logger.debug(`👤 Socket ${socket.id} left room: ${room}`);
    });

    // Custom events
    socket.on("ping", (data) => {
      socket.emit("pong", { timestamp: Date.now(), ...data });
    });

    // Error handling
    socket.on("error", (error) => {
      logger.error("Socket error:", {
        socketId: socket.id,
        error: error.message,
      });
    });

    // Disconnection handling
    socket.on("disconnect", (reason) => {
      // Don't log "transport close" or "ping timeout" as errors, they are normal
      if (reason !== "transport close" && reason !== "ping timeout") {
        logger.debug("❌ Client disconnected:", {
          socketId: socket.id,
          reason,
        });
      }
    });
  });

  // Make io available globally for other services
  global.io = io;

  return io;
}
