import Agenda from 'agenda';
import mongoose from 'mongoose';
import { Reminder, Notification, User } from '../models/index.js';
import config from '../config/env.js';

class AgendaService {
  constructor() {
    this.agenda = null;
  }

  async initialize() {
    try {
      this.agenda = new Agenda({
        mongo: mongoose.connection.db,
        db: { collection: 'agendaJobs' },
        processEvery: '30 seconds',
      });

      this.defineJobs();

      await this.agenda.start();
      console.log(' Agenda scheduler initialized');

      // Optional: Reschedule on server restart
      // await this.scheduleExistingReminders(); 
    } catch (error) {
      console.error('❌ Failed to initialize Agenda:', error);
    }
  }

  defineJobs() {
    // ============================================================
    // JOB: SEND REMINDER
    // ============================================================
    this.agenda.define('send-reminder-notification', async (job) => {
      const { reminderId } = job.attrs.data;
      
      try {
        const reminder = await Reminder.findById(reminderId)
          .populate('assignedTo', '_id') // We need IDs to create notifications
          .populate('relatedEvent', 'title')
          .populate('relatedClient', 'name');
        
        if (!reminder) return; // Reminder deleted

        // 1. Validate State
        if (reminder.isArchived || reminder.status === 'completed' || reminder.dismissed) {
          return; // Don't notify
        }

        // 2. Identify Recipients
        // If assignedTo is empty, notify the creator? Or Business Admins?
        // For now, assuming assignedTo has users.
        const recipients = reminder.assignedTo.map(u => u._id);

        if (recipients.length === 0 && reminder.createdBy) {
           recipients.push(reminder.createdBy);
        }

        // 3. Create Persistent Notifications (One per user)
        const notificationsToCreate = recipients.map(userId => ({
          recipient: userId,
          businessId: reminder.businessId,
          type: 'reminder',
          title: `Reminder: ${reminder.title}`,
          message: reminder.description || `Upcoming ${reminder.type}`,
          data: {
            entityId: reminder._id,
            entityType: 'Reminder',
            link: `/reminders/${reminder._id}`
          },
          isRead: false
        }));

        // Bulk insert notifications
        if (notificationsToCreate.length > 0) {
          await Notification.insertMany(notificationsToCreate);
        }

        // 4. Send Real-time Socket Event
        // We emit to the Business Room (Room = businessId)
        // The Frontend filters if the alert is for "me" or shows generic alerts
        if (global.io) {
          global.io.to(reminder.businessId.toString()).emit("reminder:alert", {
             id: reminder._id,
             title: reminder.title,
             description: reminder.description,
             type: reminder.type,
             assignedTo: recipients, // Frontend checks if current user ID is in this array
             priority: reminder.priority
          });
        }
        
      } catch (error) {
        console.error(`Error processing reminder ${reminderId}:`, error);
      }
    });

    // Cleanup Job
    this.agenda.define('cleanup-old-jobs', async () => {
      const date = new Date();
      date.setDate(date.getDate() - 3);
      await this.agenda.cancel({ nextRunAt: { $lt: date } });
    });
  }

  // ============================================================
  // PUBLIC METHODS CALLED BY CONTROLLER
  // ============================================================

  async scheduleReminder(reminder) {
    // 1. Calculate time
    const scheduleTime = this.getReminderDateTime(reminder);
    const now = new Date();

    // 2. Logic: If time is past, run "now", else run at time
    const runAt = scheduleTime < now ? 'now' : scheduleTime;

    // 3. Define payload
    const jobData = {
      reminderId: reminder._id,
      businessId: reminder.businessId // Save context
    };

    // 4. Schedule
    await this.agenda.schedule(runAt, 'send-reminder-notification', jobData);
    console.log(`⏰ Scheduled reminder ${reminder.title} for ${runAt}`);
  }

  async updateReminderSchedule(reminder) {
    // 1. Cancel old jobs for this ID
    await this.cancelReminderJobs(reminder._id);

    // 2. Re-schedule if valid
    if (!reminder.isArchived && reminder.status === 'active' && !reminder.dismissed) {
      await this.scheduleReminder(reminder);
    }
  }

  async cancelReminderJobs(reminderId) {
    await this.agenda.cancel({
      name: 'send-reminder-notification',
      'data.reminderId': reminderId // Mongoose ID or String depending on how saved
    });
  }

  // Helper
  getReminderDateTime(reminder) {
    // reminderDate is Date (00:00:00), reminderTime is String ("14:30")
    // We need to merge them carefully regarding Timezone (usually assume server local or UTC)
    
    // Simplest approach: Parse strings
    const dateStr = new Date(reminder.reminderDate).toISOString().split('T')[0]; // "2023-10-25"
    const timeStr = reminder.reminderTime; // "14:30"
    
    return new Date(`${dateStr}T${timeStr}:00`); 
  }

  async stop() {
    if (this.agenda) await this.agenda.stop();
  }
}

export const agendaService = new AgendaService();