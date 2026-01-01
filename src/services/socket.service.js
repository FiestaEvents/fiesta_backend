import { Server } from "socket.io";
import jwt from "jsonwebtoken"; // Needed for auth
import config from "../config/env.js";
import { logger } from "../utils/logger.js";
import { User } from "../models/index.js"; // Import User model

let io;

export function initializeSocketIO(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: [
        config.frontend.url,
        "http://localhost:3000",
        "http://app.fiesta.events",
      ],
      credentials: true,
    },
    transports: ["polling", "websocket"],
  });

  // 🔒 MIDDLEWARE: Authenticate & Attach Context
  io.use(async (socket, next) => {
    try {
      // 1. Get Token (Handshake auth or cookies)
      let token = socket.handshake.auth?.token;
      
      // Fallback: Check cookies string if token not in auth object
      if (!token && socket.handshake.headers.cookie) {
        const cookies = socket.handshake.headers.cookie.split(';').reduce((acc, cookie) => {
          const [key, value] = cookie.trim().split('=');
          acc[key] = value;
          return acc;
        }, {});
        token = cookies.jwt;
      }

      if (!token) return next(new Error("Authentication error: No token"));

      // 2. Verify Token
      const decoded = jwt.verify(token, config.jwt.secret);
      
      // 3. Fetch User (Lightweight)
      const user = await User.findById(decoded.id).select("businessId name roleType");
      
      if (!user) return next(new Error("User not found"));

      // 4. Attach to socket session
      socket.user = user;
      socket.businessId = user.businessId?.toString();
      
      next();
    } catch (error) {
      next(new Error("Authentication failed"));
    }
  });

  io.on("connection", (socket) => {
    logger.info(`⚡ Socket connected: ${socket.user.name} (${socket.id})`);

    // ✅ CRITICAL: Join Business Room
    // This allows us to emit to io.to(businessId) later
    if (socket.businessId) {
      socket.join(socket.businessId);
      logger.debug(`👤 User joined room: ${socket.businessId}`);
    }

    // Handle manual joins
    socket.on("join_room", (room) => socket.join(room));

    socket.on("disconnect", () => {
      // cleanup if needed
    });
  });

  // Assign to global for Agenda service
  global.io = io;
  return io;
}

// Export a helper to get IO instance anywhere
export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
};