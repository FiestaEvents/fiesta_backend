import mongoose from "mongoose";

const portfolioItemSchema = new mongoose.Schema({
  url: { type: String, required: true },
  publicId: String, // For Cloudinary/Storage management
  type: { type: String, enum: ['image', 'video'], default: 'image' },
  caption: String,
  isCover: { type: Boolean, default: false }
});

const portfolioSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Project title is required"],
      trim: true,
    },
    description: {
      type: String,
      maxlength: 1000,
    },
    category: {
      type: String,
      required: true,
      // Examples: "Wedding", "Portrait", "Corporate", "Interior"
    },
    date: {
      type: Date,
      default: Date.now,
    },
    
    // The collection of media
    items: [portfolioItemSchema],
    
    // Link to specific Client or Event (Optional context)
    relatedEvent: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
    relatedClient: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },

    // Visibility
    isPublic: { type: Boolean, default: true },
    isArchived: { type: Boolean, default: false },

    // Multi-tenancy
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }
  },
  {
    timestamps: true,
  }
);

// Indexes
portfolioSchema.index({ businessId: 1, category: 1 });

export default mongoose.model('Portfolio', portfolioSchema);