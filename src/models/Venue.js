import mongoose from "mongoose";

const venueSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Venue name is required"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Description is required"],
    },
    address: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      zipCode: { type: String, required: true },
      country: { type: String, required: true },
    },
    contact: {
      phone: { type: String, required: true },
      email: {
        type: String,
        required: true,
        match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
      },
    },
    capacity: {
      min: { type: Number, required: true, min: 1 },
      max: { type: Number, required: true, min: 1 },
    },
    pricing: {
      basePrice: { type: Number, required: true, min: 0 },
    },
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
    subscription: {
      plan: {
        type: String,
        enum: ["free", "monthly", "annual", "lifetime", "custom"],
        required: true,
      },
      status: {
        type: String,
        enum: ["active", "inactive", "pending", "cancelled"],
        required: true,
      },
      startDate: { type: Date, required: true },
      endDate: { type: Date },
      amount: { type: Number, required: true },
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    isActive: { type: Boolean, default: true },
    timeZone: { type: String, required: true, default: "UTC" },
  },
  {
    timestamps: true,
  }
);

// Cascade delete related documents
venueSchema.pre("deleteOne", { document: true }, async function (next) {
  const venueId = this._id;

  // Import models
  const Event = mongoose.model("Event");
  const Client = mongoose.model("Client");
  const Partner = mongoose.model("Partner");
  const Payment = mongoose.model("Payment");
  const Finance = mongoose.model("Finance");
  const Task = mongoose.model("Task");
  const Reminder = mongoose.model("Reminder");
  const Role = mongoose.model("Role");
  const User = mongoose.model("User");

  // Delete all related documents
  await Promise.all([
    Event.deleteMany({ venueId }),
    Client.deleteMany({ venueId }),
    Partner.deleteMany({ venueId }),
    Payment.deleteMany({ venueId }),
    Finance.deleteMany({ venueId }),
    Task.deleteMany({ venueId }),
    Reminder.deleteMany({ venueId }),
    Role.deleteMany({ venueId, isSystemRole: false }),
    User.deleteMany({ venueId }),
  ]);

  next();
});

export default mongoose.model("Venue", venueSchema);
