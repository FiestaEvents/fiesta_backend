import { createTransport } from "nodemailer";
import config from "../config/env.js";

// Create reusable transporter using named import
const transporter = createTransport({
  host: config.email?.host || process.env.EMAIL_HOST,
  port: config.email?.port || process.env.EMAIL_PORT || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: config.email?.user || process.env.EMAIL_USER,
    pass: config.email?.password || process.env.EMAIL_PASS,
  },
});

// Verify transporter configuration
transporter.verify(function (error, success) {
  if (error) {
    console.log('❌ Email service error:', error.message);
    console.log('⚠️  Email features will not work. Please configure email settings.');
  } else {
    console.log('✅ Email service is ready');
  }
});

/**
 * Generic email sending function
 */
export const sendEmail = async (emailOptions) => {
  try {
    const mailOptions = {
      from: config.email?.from || process.env.EMAIL_FROM || 'noreply@venuemgmt.com',
      ...emailOptions,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent successfully to ${emailOptions.to}`);
    return result;
  } catch (error) {
    console.error('❌ Email sending error:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

/**
 * Send invoice email with PDF attachment
 */
export const sendInvoiceEmail = async ({ to, subject, text, pdfBuffer, filename }) => {
  try {
    const info = await transporter.sendMail({
      from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
      to,
      subject,
      text, // Plain text body
      html: `<p>${text.replace(/\n/g, "<br>")}</p>`, // HTML body
      attachments: [
        {
          filename: filename,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });

    console.log("Message sent: %s", info.messageId);
    return info;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
};

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
  const inviteLink = `${config.frontend?.url || process.env.FRONTEND_URL}/accept-invitation?token=${token}`;

  const mailOptions = {
    from: config.email?.from || process.env.EMAIL_FROM,
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
  const resetLink = `${config.frontend?.url || process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

  const mailOptions = {
    from: config.email?.from || process.env.EMAIL_FROM,
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
    from: config.email?.from || process.env.EMAIL_FROM,
    to: email,
    subject: `Welcome to ${venueName}!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to ${venueName}! 🎉</h2>
        <p>Hi ${userName},</p>
        <p>Your account has been successfully created. You can now log in and start managing your venue.</p>
        
        <a href="${config.frontend?.url || process.env.FRONTEND_URL}/login" 
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
    // Don't throw error for welcome emails - it's not critical
  }
};

/**
 * Send payment receipt email
 */
export const sendPaymentReceiptEmail = async ({
  to,
  clientName,
  venueName,
  invoiceNumber,
  amount,
  paymentMethod,
  paymentDate,
  reference,
}) => {
  const mailOptions = {
    from: config.email?.from || process.env.EMAIL_FROM,
    to,
    subject: `Payment Receipt - Invoice ${invoiceNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Payment Received</h2>
        <p>Dear ${clientName},</p>
        <p>Thank you for your payment. We have received the following payment:</p>
        
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Invoice Number:</strong> ${invoiceNumber}</p>
          <p style="margin: 5px 0;"><strong>Amount Paid:</strong> $${amount.toFixed(2)}</p>
          <p style="margin: 5px 0;"><strong>Payment Method:</strong> ${paymentMethod}</p>
          <p style="margin: 5px 0;"><strong>Payment Date:</strong> ${new Date(paymentDate).toLocaleDateString()}</p>
          ${reference ? `<p style="margin: 5px 0;"><strong>Reference:</strong> ${reference}</p>` : ''}
        </div>
        
        <p>If you have any questions about this payment, please contact us.</p>
        
        <p>Best regards,<br>${venueName}</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Payment receipt email sent to ${to}`);
  } catch (error) {
    console.error(`❌ Error sending payment receipt to ${to}:`, error);
    // Don't throw - payment is already processed
  }
};

/**
 * Send invoice reminder email
 */
export const sendInvoiceReminderEmail = async ({
  to,
  clientName,
  venueName,
  invoiceNumber,
  dueDate,
  amountDue,
  daysOverdue = 0,
}) => {
  const isOverdue = daysOverdue > 0;
  const subject = isOverdue 
    ? `Overdue Invoice Reminder - ${invoiceNumber}` 
    : `Invoice Due Soon - ${invoiceNumber}`;

  const mailOptions = {
    from: config.email?.from || process.env.EMAIL_FROM,
    to,
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: ${isOverdue ? '#DC2626' : '#F59E0B'};">
          ${isOverdue ? 'Payment Overdue' : 'Payment Due Soon'}
        </h2>
        <p>Dear ${clientName},</p>
        <p>This is a ${isOverdue ? 'reminder' : 'friendly reminder'} that the following invoice is ${isOverdue ? 'overdue' : 'due soon'}:</p>
        
        <div style="background: ${isOverdue ? '#FEE2E2' : '#FEF3C7'}; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Invoice Number:</strong> ${invoiceNumber}</p>
          <p style="margin: 5px 0;"><strong>Due Date:</strong> ${new Date(dueDate).toLocaleDateString()}</p>
          <p style="margin: 5px 0;"><strong>Amount Due:</strong> $${amountDue.toFixed(2)}</p>
          ${isOverdue ? `<p style="margin: 5px 0; color: #DC2626;"><strong>Days Overdue:</strong> ${daysOverdue}</p>` : ''}
        </div>
        
        <p>${isOverdue 
          ? 'Please submit your payment as soon as possible to avoid any late fees.' 
          : 'Please ensure payment is made by the due date.'
        }</p>
        
        <p>If you have already made this payment, please disregard this reminder.</p>
        
        <p>Best regards,<br>${venueName}</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Invoice reminder sent to ${to}`);
  } catch (error) {
    console.error(`❌ Error sending invoice reminder to ${to}:`, error);
    throw new Error('Failed to send invoice reminder');
  }
};

export default {
  sendEmail,
  sendInvoiceEmail,
  sendInvitationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendPaymentReceiptEmail,
  sendInvoiceReminderEmail,
};