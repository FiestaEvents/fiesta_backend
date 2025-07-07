import jwt from "jsonwebtoken"
import User from "../models/User.js"

export const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "")

    if (!token) {
      return res.status(401).json({ message: "Access denied. No token provided." })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const user = await User.findById(decoded.userId).populate("venueId")

    if (!user) {
      return res.status(401).json({ message: "Invalid token. User not found." })
    }

    if (!user.isActive) {
      return res.status(401).json({ message: "Account is deactivated." })
    }

    req.user = user
    next()
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ message: "Invalid token." })
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expired." })
    }
    res.status(500).json({ message: "Server error during authentication." })
  }
}

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required." })
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: "Access denied. Insufficient permissions.",
        required: roles,
        current: req.user.role,
      })
    }

    next()
  }
}

export const checkPermission = (resource, action) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required." })
    }

    const rolePermissions = {
      owner: {
        clients: ["view", "create", "edit", "delete"],
        partners: ["view", "create", "edit", "delete"],
        events: ["view", "create", "edit", "delete"],
        payments: ["view", "create", "edit", "delete"],
        finance: ["view", "create", "edit", "delete"],
        tasks: ["view", "create", "edit", "delete"],
        reminders: ["view", "create", "edit", "delete"],
        users: ["view", "create", "edit", "delete"],
      },
      manager: {
        clients: ["view", "create", "edit"],
        partners: ["view", "create", "edit"],
        events: ["view", "create", "edit"],
        payments: ["view", "edit"],
        finance: ["view"],
        tasks: ["view", "create", "edit"],
        reminders: ["view", "create", "edit"],
        users: ["view"],
      },
      staff: {
        clients: ["view"],
        partners: ["view"],
        events: ["view"],
        tasks: ["view", "edit"],
        reminders: ["view"],
      },
      viewer: {
        events: ["view"],
      },
    }

    const userPermissions = rolePermissions[req.user.role] || {}
    const resourcePermissions = userPermissions[resource] || []

    if (!resourcePermissions.includes(action)) {
      return res.status(403).json({
        message: `Access denied. Cannot ${action} ${resource}.`,
        role: req.user.role,
        permissions: resourcePermissions,
      })
    }

    next()
  }
}
