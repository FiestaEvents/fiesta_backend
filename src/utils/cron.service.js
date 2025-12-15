import cron from "node-cron";
import Reminder from "../models/Reminder.js"; 
// import { sendEmail } from "./email.service.js"; // Optional: If you have an email service
/**
 * Initialize all system cron jobs
 */
export const initCronJobs = () => {
  console.log("⏰ Cron Scheduler Initialized");

  // =======================================================
  // JOB: Check for Reminders (Runs every minute at 00 seconds)
  // Pattern: * * * * * (Every minute)
  // =======================================================
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();

      // 1. Prepare Date Range for "Today"
      // We do this to ensure we match the stored reminderDate regardless of its specific timestamp (midnight vs noon)
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);

      // 2. Prepare Time String (HH:mm)
      // Note: This relies on the server time. If your server is UTC, this generates UTC time.
      // Format ensures "09:05" instead of "9:5"
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const currentTimeString = `${hours}:${minutes}`;

      console.log(`⏳ [CRON] Checking reminders for: ${startOfDay.toISOString().split('T')[0]} at ${currentTimeString}`);

      // 3. Query the Database
      const dueReminders = await Reminder.find({
        // Match Date: Is strictly within today's range
        reminderDate: {
          $gte: startOfDay,
          $lte: endOfDay,
        },
        // Match Time: Exact string match "HH:mm"
        reminderTime: currentTimeString,
        
        // Status Checks
        status: "active",
        isArchived: false,
        dismissed: false, // Don't show if user dismissed it
      }).populate("assignedTo", "email firstName lastName");

      // 4. Process Results
      if (dueReminders.length > 0) {
        console.log(`🔔 Found ${dueReminders.length} reminders due now.`);
        
        for (const reminder of dueReminders) {
          await processNotification(reminder);
        }
      }

    } catch (error) {
      console.error("❌ [CRON] Error checking reminders:", error);
    }
  });
};

/**
 * Handle the logic of sending the notification
 */
async function processNotification(reminder) {
  try {
    // ----------------------------------------------------
    // OPTION A: Socket.io (Real-time Popup)
    // ----------------------------------------------------
    // If you have set up global.io or can import io instance:
    // global.io.to(reminder.venueId).emit("notification", { ...reminder });
    
    // ----------------------------------------------------
    // OPTION B: Console Log (For verification)
    // ----------------------------------------------------
    console.log(`\n🚀 SENDING NOTIFICATION:
      TO: ${reminder.assignedTo.map(u => u.email).join(", ")}
      TITLE: ${reminder.title}
      TYPE: ${reminder.type}
    `);

    // ----------------------------------------------------
    // OPTION C: Push Notification / Email Logic Here
    // ----------------------------------------------------
    // await sendEmail(....);

  } catch (error) {
    console.error(`Failed to process reminder ${reminder._id}:`, error);
  }
}