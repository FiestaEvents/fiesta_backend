import nodemailer from "nodemailer";
import config from "../config/env.js";

// Create reusable transporter
const transporter = nodemailer.createTransport({
  host: config.email.host,
  port: config.email.port,
  secure: false,
  auth: {
    user: config.email.user,
    pass: config.email.pass,
  },
});

/**
 * Send team invitation email
 */
export const sendInvitationEmail = async ({
  email,
  token,
  inviterName,
  venueName,
  roleName,
  message,
}) => {
  const inviteLink = `${config.frontend.url}/accept-invitation?token=${token}`;

  const mailOptions = {
    from: config.email.from,
    to: email,
    subject: `You're invited to join ${venueName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>You've been invited to join ${venueName}</h2>
        <p>${inviterName} has invited you to join their team as a <strong>${roleName}</strong>.</p>
        
        ${message ? `<p><em>"${message}"</em></p>` : ""}
        
        <p>Click the button below to accept the invitation:</p>
        
        <a href="${inviteLink}" 
           style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; 
                  color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
          Accept Invitation
        </a>
        
        <p style="color: #666; font-size: 14px;">
          Or copy and paste this link into your browser:<br>
          <a href="${inviteLink}">${inviteLink}</a>
        </p>
        
        <p style="color: #666; font-size: 14px;">
          This invitation will expire in 7 days.
        </p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Invitation email sent to ${email}`);
  } catch (error) {
    console.error(`❌ Error sending email to ${email}:`, error);
    throw new Error("Failed to send invitation email");
  }
};

/**
 * Send password reset email
 */
export const sendPasswordResetEmail = async ({ email, resetToken, userName }) => {
  const resetLink = `${config.frontend.url}/reset-password?token=${resetToken}`;

  const mailOptions = {
    from: config.email.from,
    to: email,
    subject: "Password Reset Request",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset Request</h2>
        <p>Hi ${userName},</p>
        <p>You recently requested to reset your password. Click the button below to reset it:</p>
        
        <a href="${resetLink}" 
           style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; 
                  color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
          Reset Password
        </a>
        
        <p style="color: #666; font-size: 14px;">
          Or copy and paste this link into your browser:<br>
          <a href="${resetLink}">${resetLink}</a>
        </p>
        
        <p style="color: #666; font-size: 14px;">
          This link will expire in 1 hour. If you didn't request a password reset, please ignore this email.
        </p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Password reset email sent to ${email}`);
  } catch (error) {
    console.error(`❌ Error sending email to ${email}:`, error);
    throw new Error("Failed to send password reset email");
  }
};

/**
 * Send welcome email
 */
export const sendWelcomeEmail = async ({ email, userName, venueName }) => {
  const mailOptions = {
    from: config.email.from,
    to: email,
    subject: `Welcome to ${venueName}!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to ${venueName}! 🎉</h2>
        <p>Hi ${userName},</p>
        <p>Your account has been successfully created. You can now log in and start managing your venue.</p>
        
        <a href="${config.frontend.url}/login" 
           style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; 
                  color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
          Go to Dashboard
        </a>
        
        <p>If you have any questions, feel free to reach out to our support team.</p>
        
        <p>Best regards,<br>Venue Management Team</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Welcome email sent to ${email}`);
  } catch (error) {
    console.error(`❌ Error sending email to ${email}:`, error);
  }
};