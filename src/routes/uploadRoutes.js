import express from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import { authenticate } from "../middleware/auth.js";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

// 1. Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 2. Configure Multer Storage Engine for Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "fiesta_portfolio", // The folder name in your Cloudinary Dashboard
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    // Optional: Resize images on upload to save bandwidth
    transformation: [{ width: 1200, height: 1200, crop: "limit" }], 
  },
});

const upload = multer({ storage });

// 3. Upload Route
// POST /api/v1/upload
router.post("/", authenticate, upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  // Cloudinary returns the HTTPS URL in req.file.path
  res.status(200).json({
    success: true,
    url: req.file.path,
    publicId: req.file.filename // Store this if you want to delete images later
  });
});

export default router;