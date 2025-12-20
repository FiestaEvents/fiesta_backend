import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransporter({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Verify connection
transporter.verify(function (error, success) {
  if (error) {
    console.log('❌ Error:', error);
  } else {
    console.log('✅ Server is ready to send emails');
  }
});

// Test sending
async function testEmail() {
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: 'test@example.com', // Change this
      subject: 'Test Email',
      text: 'If you receive this, email is working!',
    });
    console.log('✅ Email sent:', info.messageId);
  } catch (error) {
    console.error('❌ Failed to send:', error);
  }
}

testEmail();