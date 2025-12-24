// src/models/Business.js
const mongoose = require('mongoose');

const businessSchema = new mongoose.Schema(
  {
    // =========================================================
    // 1. COMMON IDENTITY (Shared by Everyone)
    // =========================================================
    name: {
      type: String,
      required: [true, "Business name is required"],
      trim: true,
      index: true
    },
    description: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      enum: [
        "venue",       // The original
        "driver",
        "bakery",
        "catering",
        "decoration",
        "photography",
        "videography", // Added specifically for creatives
        "music",
        "security",
        "cleaning",
        "audio_visual",
        "floral",
        "entertainment",
        "hairstyling",
        "other",
      ],
      default: "venue",
      index: true // Indexed for filtering dashboard views
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true // Indexed for Auth checks
    },
    
    // Common Contact & Location
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
      // GeoJSON format for "Service Radius" calculations (Phase 2)
      location: {
        type: {
          type: String, 
          enum: ['Point'], 
          default: 'Point'
        },
        coordinates: {
          type: [Number], // [longitude, latitude]
          default: [0, 0]
        }
      }
    },
    contact: {
      phone: String,
      email: String,
      website: String,
      socialMedia: {
        facebook: String,
        instagram: String,
        linkedin: String,
        tiktok: String
      }
    },

    // =========================================================
    // 2. VENUE SPECIFIC DATA (Only if category === 'venue')
    // =========================================================
    venueDetails: {
      // CRITICAL: Links to the existing Space/Room model
      spaces: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Space" 
      }],
      capacity: {
        min: { type: Number, default: 0 },
        max: { type: Number, default: 0 },
      },
      amenities: [String],
      operatingHours: {
        monday: { open: String, close: String, closed: { type: Boolean, default: false } },
        tuesday: { open: String, close: String, closed: { type: Boolean, default: false } },
        wednesday: { open: String, close: String, closed: { type: Boolean, default: false } },
        thursday: { open: String, close: String, closed: { type: Boolean, default: false } },
        friday: { open: String, close: String, closed: { type: Boolean, default: false } },
        saturday: { open: String, close: String, closed: { type: Boolean, default: false } },
        sunday: { open: String, close: String, closed: { type: Boolean, default: false } },
      },
      pricing: {
        basePrice: { type: Number, default: 0 },
        currency: { type: String, default: "TND" }
      }
    },

    // =========================================================
    // 3. SERVICE SPECIFIC DATA (Drivers, Photographers, etc.)
    // =========================================================
    serviceDetails: {
      priceType: {
        type: String,
        enum: ["hourly", "fixed", "package", "per_item"],
        default: "fixed"
      },
      baseRate: { type: Number, default: 0 },
      serviceRadiusKM: { type: Number, default: 50 }, // Renamed to explicitly state KM
      travelFee: { type: Number, default: 0 },
      portfolio: [
        {
          url: String, // Cloudinary/S3 URL
          title: String,
          description: String,
          tags: [String]
        }
      ],
      equipment: [String] // e.g. "Canon R5", "Mercedes S-Class"
    },

    // =========================================================
    // 4. SUBSCRIPTION & SYSTEM
    // =========================================================
    subscription: {
      plan: {
        type: String,
        enum: ["free", "pro", "enterprise"],
        default: "free",
      },
      status: {
        type: String,
        enum: ["active", "past_due", "canceled", "trial"],
        default: "active",
      },
      startDate: Date,
      endDate: Date,
    },
    settings: {
      currency: { type: String, default: "TND" },
      taxRate: { type: Number, default: 19 },
      logo: String,
      primaryColor: String
    },
    isActive: { type: Boolean, default: true },
    isArchived: { type: Boolean, default: false },
    timeZone: { type: String, default: "Africa/Tunis" },
  },
  {
    timestamps: true,
  }
);

// Index for Geospatial queries (finding Drivers/Venues near a location)
businessSchema.index({ "address.location": "2dsphere" });

module.exports = mongoose.model("Business", businessSchema);