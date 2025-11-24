import express from "express";
import { protect } from "../middleware/auth.js";
// Do NOT import the controller yet.

const router = express.Router();

router.use(protect);

// 1. GET SETTINGS (Inline)
router.get("/", async (req, res) => {
  console.log("✅ ROUTER HIT: /invoices/settings (Get)");
  return res.json({
    success: true,
    data: {
      venue: req.user.venueId,
      branding: {
        logo: { url: "", width: 150 },
        colors: { primary: "#F18237", secondary: "#374151" }
      },
      layout: { template: "modern", sections: [] },
      table: { columns: { description: true, total: true } },
      labels: { invoiceTitle: "INVOICE" }
    }
  });
});

// 2. UPDATE SETTINGS (Inline)
router.put("/", async (req, res) => {
  console.log("✅ ROUTER HIT: /invoices/settings (Update)");
  return res.json({ success: true, message: "Settings Updated" });
});

router.post("/preview", (req, res) => res.json({ success: true }));
router.post("/apply-template", (req, res) => res.json({ success: true }));
router.post("/reset", (req, res) => res.json({ success: true }));

export default router;