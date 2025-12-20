import dotenv from "dotenv";

dotenv.config();

const config = {
  env: process.env.NODE_ENV || "development",
  port: process.env.PORT || 5000,
  
  mongodb: {
    uri: process.env.MONGODB_URI || "mongodb://localhost:27017/venue-management",
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || "your-secret-key-change-in-production",
    expire: process.env.JWT_EXPIRE || "7d",
    cookieExpire: parseInt(process.env.JWT_COOKIE_EXPIRE) || 7,
  },
  
  email: {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM || "noreply@venuemanagement.com",
  },
  
  frontend: {
    url: process.env.FRONTEND_URL || "http://localhost:3000",
  },
  
rateLimit: {
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' 
    ? (parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100)
    : 1000, // High limit for development
},
};

export default config;