import mongoose from "mongoose";

const venueSpaceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Venue space name is required"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Description is required"],
    },

    capacity: {
      min: { type: Number, required: true, min: 1 },
      max: { type: Number, required: true, min: 1 },
    },

    basePrice: { type: Number, required: true, min: 0 },
    amenities: [String],
    images: [String],
    operatingHours: {
      monday: {
        open: String,
        close: String,
        closed: { type: Boolean, default: false },
      },
      tuesday: {
        open: String,
        close: String,
        closed: { type: Boolean, default: false },
      },
      wednesday: {
        open: String,
        close: String,
        closed: { type: Boolean, default: false },
      },
      thursday: {
        open: String,
        close: String,
        closed: { type: Boolean, default: false },
      },
      friday: {
        open: String,
        close: String,
        closed: { type: Boolean, default: false },
      },
      saturday: {
        open: String,
        close: String,
        closed: { type: Boolean, default: false },
      },
      sunday: {
        open: String,
        close: String,
        closed: { type: Boolean, default: false },
      },
    },
    venueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Venue",
      required: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    isReserved: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    isArchived: { type: Boolean, default: false },
    timeZone: { type: String, required: true, default: "UTC" },
  },
  {
    timestamps: true,
  }
);

// Cascade delete related documents
venueSpaceSchema.pre("deleteOne", { document: true }, async function (next) {
  const venueId = this._id;

  // Import models
  const Event = mongoose.model("Event");
  const Task = mongoose.model("Task");
  const Reminder = mongoose.model("Reminder");

  // Delete all related documents
  await Promise.all([
    Event.deleteMany({ venueId }),
    Task.deleteMany({ venueId }),
    Reminder.deleteMany({ venueId }),
  ]);

  next();
});

export default mongoose.model("VenueSpace", venueSpaceSchema);
