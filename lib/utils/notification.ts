import { Resend } from 'resend';
import admin from 'firebase-admin';
import Notification, {
  INotification,
  NotificationType,
  NotificationChannel,
  NotificationPriority,
} from '../models/notification.model';
import User from '@/lib/db/models/user.model';
import { connectToDatabase } from '@/lib/db';
import RateLimit from '@/lib/db/models/rate-limit.model'; // نموذج جديد لتتبع معدل الإرسال

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n')!,
      }),
    });
  } catch (error) {
    console.error('Firebase admin initialization error:', error);
  }
}

export interface NotificationOptions {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  channels?: NotificationChannel[];
  priority?: NotificationPriority;
  expiresAt?: Date;
  metadata?: {
    browser?: string;
    device?: string;
    ip?: string;
  };
}

export async function sendNotification(options: NotificationOptions) {
  try {
    await connectToDatabase();

    const {
      userId,
      type,
      title,
      message,
      data = {},
      channels = ['email'],
      priority = 'medium',
      expiresAt,
      metadata,
    } = options;

    // Create notification record
    const notification = await Notification.create({
      userId,
      type,
      title,
      message,
      data,
      channels,
      priority,
      expiresAt,
      metadata,
      status: 'pending',
    });

    // Send notifications through selected channels
    const promises = channels.map(async (channel) => {
      try {
        switch (channel) {
          case 'email':
            const userEmail = await getUserEmail(userId);
            if (userEmail) {
              await sendEmail({
                to: userEmail,
                subject: title,
                html: getEmailTemplate(type, title, message, data, 'en'),
                data,
              });
            }
            break;

          case 'push':
            const pushToken = await getUserPushToken(userId);
            if (pushToken) {
              await sendPushNotification({
                token: pushToken,
                title,
                body: message,
                data,
              });
            }
            break;

          case 'sms':
            const phoneNumber = await getUserPhone(userId);
            if (phoneNumber) {
              await sendSMS({
                to: phoneNumber,
                message: `${title}\n\n${message}`,
              });
            }
            break;

          case 'in_app':
            // In-app notifications are handled by the notification record
            break;
        }
      } catch (error) {
        console.error(`${channel} notification error:`, error);
      }
    });

    await Promise.allSettled(promises);

    // Update notification status
    await notification.markAsSent();

    return { success: true, notificationId: notification._id };
  } catch (error) {
    console.error('Notification error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send notification',
    };
  }
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  data?: Record<string, any>;
}

export async function sendEmail({ to, subject, html, data }: EmailOptions) {
  try {
    const canSend = await checkEmailRateLimit();
    if (!canSend) {
      throw new Error('Email rate limit exceeded');
    }

    const response = await resend.emails.send({
      from: `${process.env.SITE_NAME} <${process.env.SENDER_EMAIL}>`,
      to,
      subject,
      html,
      tags: [
        { name: 'category', value: data?.type || 'general' },
        { name: 'priority', value: data?.priority || 'normal' },
      ],
    });

    if (response.error) {
      throw new Error(response.error.message);
    }

    return response;
  } catch (error) {
    console.error('Email error:', error);
    throw new Error('Failed to send email');
  }
}

export interface PushNotificationOptions {
  token: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

export async function sendPushNotification({
  token,
  title,
  body,
  data,
}: PushNotificationOptions) {
  if (!token) return;

  try {
    await admin.messaging().send({
      token,
      notification: {
        title,
        body,
      },
      data: Object.entries(data || {}).reduce(
        (acc, [key, value]) => ({
          ...acc,
          [key]: String(value),
        }),
        {}
      ),
      android: {
        priority: 'high',
        notification: {
          clickAction: 'FLUTTER_NOTIFICATION_CLICK',
          sound: 'default',
        },
      },
      apns: {
        payload: {
          aps: {
            contentAvailable: true,
            sound: 'default',
            badge: 1,
          },
        },
      },
      webpush: {
        headers: {
          Urgency: 'high',
        },
        notification: {
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-72x72.png',
        },
      },
    });
  } catch (error) {
    console.error('Push notification error:', error);
    throw new Error('Failed to send push notification');
  }
}

export interface SMSOptions {
  to: string;
  message: string;
}

export async function sendSMS({ to, message }: SMSOptions) {
  try {
    // Textlocal API configuration
    const apiKey = process.env.TEXTLOCAL_API_KEY;
    if (!apiKey) {
      throw new Error('Textlocal API key not configured');
    }

    const response = await fetch('https://api.textlocal.in/send/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        apikey: apiKey,
        numbers: to,
        message: encodeURIComponent(message),
        sender: process.env.TEXTLOCAL_SENDER || 'MGZON',
      }).toString(),
    });

    const result = await response.json();
    if (result.status !== 'success') {
      throw new Error(`Textlocal API error: ${result.errors?.[0]?.message || 'Unknown error'}`);
    }

    return result;
  } catch (error) {
    console.error('SMS error:', error);
    throw new Error('Failed to send SMS');
  }
}

export async function sendWhatsApp({ to, message }: SMSOptions) {
  try {
    // Textlocal WhatsApp API configuration
    const apiKey = process.env.TEXTLOCAL_API_KEY;
    if (!apiKey) {
      throw new Error('Textlocal API key not configured');
    }

    const response = await fetch('https://api.textlocal.in/send/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        apikey: apiKey,
        numbers: to,
        message: encodeURIComponent(message),
        sender: process.env.TEXTLOCAL_SENDER || 'MGZON',
        channel: 'whatsapp',
      }).toString(),
    });

    const result = await response.json();
    if (result.status !== 'success') {
      throw new Error(`Textlocal WhatsApp API error: ${result.errors?.[0]?.message || 'Unknown error'}`);
    }

    return result;
  } catch (error) {
    console.error('WhatsApp error:', error);
    throw new Error('Failed to send WhatsApp message');
  }
}

export async function checkEmailRateLimit(): Promise<boolean> {
  try {
    await connectToDatabase();

    const key = `email_rate_limit:${new Date().toISOString().slice(0, 10)}`;
    const limit = parseInt(process.env.EMAIL_RATE_LIMIT || '100');

    let rateLimit = await RateLimit.findOne({ key });

    if (!rateLimit) {
      rateLimit = await RateLimit.create({
        key,
        count: 1,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Expire after 24 hours
      });
      return true;
    }

    if (rateLimit.count >= limit) {
      return false;
    }

    rateLimit.count += 1;
    await rateLimit.save();
    return true;
  } catch (error) {
    console.error('Rate limit check error:', error);
    return false;
  }
}

export function getEmailTemplate(
  type: NotificationType,
  title: string,
  message: string,
  data: Record<string, any>,
  locale: string
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${title}</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <img src="/icons/logo.svg" alt="Mgzon Logo" style="height: 40px; margin-bottom: 20px;">
        <h2 style="color: #333;">${title}</h2>
        <p>${message}</p>
        ${data.productId ? `<p>Product ID: ${data.productId}</p>` : ''}
        ${data.quantity ? `<p>Quantity: ${data.quantity}</p>` : ''}
        <p style="color: #666; font-size: 12px;">
          This is an automated message from Mgzon. Please do not reply directly.
        </p>
      </div>
    </body>
    </html>
  `;
}

// Helper functions to get user contact information
async function getUserEmail(userId: string): Promise<string | null> {
  const user = await User.findById(userId).select('email');
  return user?.email || null;
}

async function getUserPhone(userId: string): Promise<string | null> {
  const user = await User.findById(userId).select('phone');
  return user?.phone || null;
}

async function getUserPushToken(userId: string): Promise<string | null> {
  const user = await User.findById(userId).select('pushToken');
  return user?.pushToken || null;
}

// Export utility functions for notification management
export const NotificationUtils = {
  markAsRead: async (notificationId: string) => {
    await connectToDatabase();
    const notification = await Notification.findById(notificationId);
    if (notification) {
      await notification.markAsRead();
    }
  },

  getUnreadCount: async (userId: string) => {
    await connectToDatabase();
    return Notification.countDocuments({ userId, read: false });
  },

  getUserNotifications: async (userId: string, limit = 10, skip = 0) => {
    await connectToDatabase();
    return Notification.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
  },

  deleteNotification: async (notificationId: string) => {
    await connectToDatabase();
    await Notification.findByIdAndDelete(notificationId);
  },

  clearAllNotifications: async (userId: string) => {
    await connectToDatabase();
    await Notification.deleteMany({ userId });
  },

  markAllAsRead: async (userId: string) => {
    await connectToDatabase();
    await Notification.updateMany(
      { userId, read: false },
      {
        $set: {
          read: true,
          readAt: new Date(),
          status: 'read',
        },
      }
    );
  },
};