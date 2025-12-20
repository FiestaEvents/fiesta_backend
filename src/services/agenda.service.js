//src/services/agenda.service.js
import Agenda from 'agenda';
import mongoose from 'mongoose';
import Reminder from '../models/Reminder.js';

class AgendaService {
  constructor() {
    this.agenda = null;
  }

  async initialize() {
    try {
      // Create Agenda instance
      this.agenda = new Agenda({
        mongo: mongoose.connection.db,
        db: { collection: 'agendaJobs' },
        defaultConcurrency: 5,
        processEvery: '30 seconds',
        maxConcurrency: 20,
      });

      // Define job handlers
      this.defineJobs();

      // Start Agenda
      await this.agenda.start();
      console.log('✅ Agenda scheduler initialized');

      // Schedule existing reminders on startup
      await this.scheduleExistingReminders();

    } catch (error) {
      console.error('❌ Failed to initialize Agenda:', error);
      throw error;
    }
  }

  defineJobs() {
    // Define reminder notification job
    this.agenda.define('send-reminder-notification', async (job) => {
      const { reminderId } = job.attrs.data;
      
      try {
        const reminder = await Reminder.findById(reminderId)
          .populate('assignedTo', 'email firstName lastName')
          .populate('relatedEvent', 'title')
          .populate('relatedClient', 'name');
        
        if (!reminder) {
          console.log(`Reminder ${reminderId} not found, cancelling job`);
          return;
        }

        // Check if reminder should still be sent
        if (reminder.isArchived || reminder.status === 'completed' || reminder.dismissed) {
          console.log(`Reminder ${reminderId} is no longer active, cancelling job`);
          return;
        }

        await this.sendNotification(reminder);
        
        // Mark as sent (optional - you could update a field)
        await Reminder.findByIdAndUpdate(reminderId, {
          $set: { lastNotifiedAt: new Date() }
        });

      } catch (error) {
        console.error(`Error processing reminder ${reminderId}:`, error);
      }
    });

    // Define cleanup job for old notifications
    this.agenda.define('cleanup-old-jobs', async () => {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      
      await this.agenda.cancel({
        name: 'send-reminder-notification',
        nextRunAt: { $lt: twoDaysAgo }
      });
    });
  }

  async scheduleReminder(reminder) {
    try {
      // Calculate when to send the reminder
      const reminderDateTime = this.getReminderDateTime(reminder);
      
      if (reminderDateTime < new Date()) {
        console.log(`Reminder ${reminder._id} is in the past, scheduling for immediate execution`);
        
        // Schedule immediately for overdue reminders
        await this.agenda.schedule('now', 'send-reminder-notification', {
          reminderId: reminder._id,
          venueId: reminder.venueId
        });
      } else {
        // Schedule for future time
        await this.agenda.schedule(reminderDateTime, 'send-reminder-notification', {
          reminderId: reminder._id,
          venueId: reminder.venueId
        });
        
        console.log(`📅 Scheduled reminder ${reminder._id} for ${reminderDateTime}`);
      }
    } catch (error) {
      console.error(`Failed to schedule reminder ${reminder._id}:`, error);
      throw error;
    }
  }

  async updateReminderSchedule(reminder) {
    try {
      // Cancel existing jobs for this reminder
      await this.cancelReminderJobs(reminder._id);
      
      // Only schedule if reminder is active
      if (!reminder.isArchived && 
          reminder.status === 'active' && 
          !reminder.dismissed) {
        await this.scheduleReminder(reminder);
      }
    } catch (error) {
      console.error(`Failed to update schedule for reminder ${reminder._id}:`, error);
      throw error;
    }
  }

  async cancelReminderJobs(reminderId) {
    await this.agenda.cancel({
      name: 'send-reminder-notification',
      'data.reminderId': reminderId
    });
  }

  async scheduleExistingReminders() {
    try {
      console.log('📋 Scheduling existing reminders...');
      
      // Find all active, non-archived, non-dismissed reminders
      const activeReminders = await Reminder.find({
        status: 'active',
        isArchived: false,
        dismissed: false
      });

      console.log(`Found ${activeReminders.length} active reminders to schedule`);

      // Schedule each reminder
      for (const reminder of activeReminders) {
        try {
          await this.scheduleReminder(reminder);
        } catch (error) {
          console.error(`Failed to schedule reminder ${reminder._id}:`, error);
        }
      }

      // Schedule cleanup job (runs daily at 3 AM)
      await this.agenda.every('0 3 * * *', 'cleanup-old-jobs');

      console.log('✅ All existing reminders scheduled');
    } catch (error) {
      console.error('Failed to schedule existing reminders:', error);
    }
  }

  getReminderDateTime(reminder) {
    // Combine reminderDate (Date) and reminderTime (String "HH:mm")
    const date = new Date(reminder.reminderDate);
    const [hours, minutes] = reminder.reminderTime.split(':').map(Number);
    
    date.setHours(hours, minutes, 0, 0);
    return date;
  }

  async sendNotification(reminder) {
    try {
      // Option A: Socket.io (Real-time Popup)
      global.io.to(reminder.venueId.toString()).emit("reminder-notification", {
        type: 'reminder',
        data: reminder,
        title: reminder.title,
        description: reminder.description,
        time: new Date().toISOString()
      });
      
      // Option B: Console Log
      console.log(`\n🚀 SENDING REMINDER NOTIFICATION:
        REMINDER ID: ${reminder._id}
        TITLE: ${reminder.title}
        TYPE: ${reminder.type}
        ASSIGNED TO: ${reminder.assignedTo?.map(u => u.email).join(", ") || 'No one'}
        TIME: ${new Date().toLocaleString()}
      `);

      // Option C: Add your email/push notification logic here
      // await this.sendEmailNotification(reminder);
      // await this.sendPushNotification(reminder);

    } catch (error) {
      console.error(`Failed to send notification for reminder ${reminder._id}:`, error);
      throw error;
    }
  }

  async sendEmailNotification(reminder) {
    // Implement your email sending logic here
    // Example:
    // const emailService = require('./email.service');
    // const users = reminder.assignedTo || [];
    // for (const user of users) {
    //   await emailService.sendReminderEmail(user.email, reminder);
    // }
  }

  async stop() {
    if (this.agenda) {
      await this.agenda.stop();
      console.log('🛑 Agenda scheduler stopped');
    }
  }
}

// Create singleton instance
export const agendaService = new AgendaService();