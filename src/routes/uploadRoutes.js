import express from "express";
import multer from "multer";
import path from "path";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

// Configure Multer Storage
const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, "uploads/"); // Images save to backend/uploads/
  },
  filename(req, file, cb) {
    cb(null, `logo-${Date.now()}${path.extname(file.originalname)}`);
  },
});

// Filter for Images Only
const fileFilter = (req, file, cb) => {
  const filetypes = /jpg|jpeg|png|webp/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error("Images only!"), false);
  }
};

const upload = multer({ 
  storage, 
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB Limit
});

// Route: POST /api/v1/upload
router.post("/", authenticate, upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }
  // Return the URL path that the frontend can access
  // Note: app.js must have app.use('/uploads', express.static...)
  res.status(200).json({
    url: `/uploads/${req.file.filename}`
  });
});

export default router;