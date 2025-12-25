import mongoose from "mongoose";
import crypto from "crypto";

const teamInvitationSchema = new mongoose.Schema(
  {
    // The actual unhashed token is sent in the invitation email/link.
    // The HASHED token is stored here for secure lookup.
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    
    // =========================================================
    // ARCHITECTURE UPDATE: Replaces venueId
    // =========================================================
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: [true, "Business ID is required for the invitation"],
    },
    
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Inviter's ID is required"],
    },
    // The email address of the person being invited
    email: {
      type: String,
      required: [true, "Recipient email is required"],
      lowercase: true,
      trim: true,
    },
    // The role to assign the user upon acceptance
    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: [true, "Role is required for the invitation"],
    },
    // Expiration date for the token
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: "0s" }, // MongoDB TTL index for automatic deletion
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "expired", "revoked", "declined"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Instance method to generate and set the invitation token and expiration.
 * This method is called by the controller when creating a new invitation.
 */
teamInvitationSchema.methods.generateInvitationToken = function () {
  // 1. Generate a raw, cryptographically secure token (for the URL)
  const rawToken = crypto.randomBytes(32).toString("hex");

  // 2. Hash the raw token (for secure storage in the database)
  const hashedToken = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");

  // 3. Set the hashed token on the document
  this.token = hashedToken;

  // 4. Set expiration time (e.g., 48 hours from now)
  // 48 hours = 48 * 60 * 60 * 1000 milliseconds
  // (Note: Changed from 7 days to 48h to match security best practices in your new controller)
  this.expiresAt = Date.now() + 48 * 60 * 60 * 1000;

  // 5. Return the raw token (to be sent to the user)
  return rawToken;
};

export default mongoose.model("TeamInvitation", teamInvitationSchema);