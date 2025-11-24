import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

// Safe transporter creation
const createTransporter = () => {
  // Only create if env vars exist to prevent crash
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) return null;
  
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_PORT == 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

export const sendInvoiceEmail = async ({ to, subject, text, pdfBuffer, filename }) => {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn("⚠️ Email Service: SMTP credentials missing. Email skipped.");
    return false;
  }

  try {
    const info = await transporter.sendMail({
      from: `"${process.env.FROM_NAME || 'Invoicing'}" <${process.env.FROM_EMAIL}>`,
      to,
      subject,
      text,
      attachments: [{ filename, content: pdfBuffer, contentType: "application/pdf" }],
    });
    console.log("✅ Email sent:", info.messageId);
    return true;
  } catch (error) {
    console.error("❌ Email Failed:", error.message);
    return false; // Return false instead of crashing
  }
};