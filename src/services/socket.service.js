// services/socket.service.js
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
      origin: getCorsOrigins(),
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization"]
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // Socket.io middleware for authentication
  io.use(async (socket, next) => {
    try {
      // You can add authentication logic here
      // Example: const token = socket.handshake.auth.token;
      // const user = await verifyToken(token);
      // socket.user = user;
      next();
    } catch (error) {
      logger.warn('Socket authentication failed:', error.message);
      next(new Error('Authentication error'));
    }
  });

  // Socket connection handling
  io.on("connection", (socket) => {
    logger.debug('⚡ Client connected via Socket:', {
      socketId: socket.id,
      handshake: socket.handshake.query
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
      logger.error('Socket error:', {
        socketId: socket.id,
        error: error.message
      });
    });

    // Disconnection handling
    socket.on("disconnect", (reason) => {
      logger.debug('❌ Client disconnected:', {
        socketId: socket.id,
        reason
      });
    });
  });

  // Make io available globally for other services
  global.io = io;

  return io;
}

/**
 * Get CORS origins based on environment
 */
function getCorsOrigins() {
  const origins = [
    config.frontend.url,
    "http://localhost:3000"
  ];

  if (config.env === 'development') {
    origins.push(/^http:\/\/localhost:\d+$/);
  }

  return origins;
}