'use server';

import admin from 'firebase-admin';
import { connectToDatabase } from '@/lib/db';
import Notification, { NotificationType, NotificationChannel, NotificationPriority } from '@/lib/db/models/notification.model';
import User from '@/lib/db/models/user.model';
import Seller from '@/lib/db/models/seller.model';
import RateLimit from '@/lib/db/models/rate-limit.model';
import { emailService } from '@/lib/services/email';
import { emailTemplates } from '@/lib/services/email/templates';
import { NOTIFICATION_CONFIG } from '@/lib/config/storage.config';
import { getTranslations } from 'next-intl/server';

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

async function sendLog(type: 'info' | 'error', message: string, meta?: any) {
  try {
    await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, message, meta }),
    });
  } catch (err) {
    console.error('Failed to send log:', err);
  }
}
type EmailTemplateType = keyof typeof emailTemplates;

function isEmailTemplateType(type: string): type is EmailTemplateType {
  return type in emailTemplates;
}


export interface NotificationOptions {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  channels?: NotificationChannel[];
  websocket?: boolean;
  priority?: NotificationPriority;
  expiresAt?: Date;
  metadata?: {
    browser?: string;
    device?: string;
    ip?: string;
  };
  locale?: string;
  isSellerSpecific?: boolean;
}

export interface PushNotificationOptions {
  token: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

export interface SMSOptions {
  to: string;
  message: string;
}

export async function sendNotification(options: NotificationOptions) {
  const t = await getTranslations('notifications');
  try {
    await connectToDatabase();

    const {
      userId,
      type,
      title,
      message,
      data = {},
      channels = NOTIFICATION_CONFIG.types[type.toUpperCase()]?.defaultChannels || ['email'],
      priority = NOTIFICATION_CONFIG.types[type.toUpperCase()]?.priority || 'medium',
      expiresAt,
      metadata,
      locale = 'en',
      isSellerSpecific = false,
    } = options;

    const user = await User.findById(userId).select('email phone fcmToken locale notifications name');
    if (!user) {
      await sendLog('error', t('User not found'), { userId });
      throw new Error(t('User not found'));
    }

    let allowedChannels = channels;
    let notificationSettings = {
      email: true,
      sms: false,
      orderUpdates: true,
      marketingEmails: false,
      pointsNotifications: true,
    };

    if (isSellerSpecific) {
      const seller = await Seller.findOne({ userId });
      notificationSettings = seller?.settings.notifications || notificationSettings;

      allowedChannels = channels.filter((channel) => {
        if (channel === 'email' && !notificationSettings.email) return false;
        if (channel === 'sms' && !notificationSettings.sms) return false;
        if (channel === 'whatsapp' && !notificationSettings.sms) return false;
        if (channel === 'in_app') return true;
        if (channel === 'push' && notificationSettings.pointsNotifications) return true;
        return true;
      });

      if (allowedChannels.length === 0) {
        await sendLog('info', t('No allowed channels'), { userId });
        return { success: true, notificationId: null, message: t('No allowed channels') };
      }
    }

    const notification = await Notification.create({
      userId,
      type,
      title,
      message,
      data,
      channels: allowedChannels,
      priority,
      expiresAt,
      metadata,
      status: 'pending',
      read: false,
    });

    const promises = allowedChannels.map(async (channel) => {
      try {
        switch (channel) {
          case 'email':
            if (user.email && (!isSellerSpecific || notificationSettings.email)) {
              const canSendEmail = await checkEmailRateLimit();
              if (!canSendEmail) {
                await Notification.findByIdAndUpdate(notification._id, {
                  status: 'queued',
                  queuedAt: new Date(),
                });
                await sendLog('info', t('Email rate limit exceeded, notification queued'), { notificationId: notification._id });
                return;
              }
              if (type === 'verification') {
                await emailService.sendVerificationCode({
                  to: user.email,
                  code: data.code || '',
                  name: user.name || 'User',
                });
              } else if (type === 'orderConfirmation') {
                await emailService.sendOrderConfirmation({
                  to: user.email,
                  order: data.order || { _id: 'unknown', totalPrice: 0 },
                  user: { name: user.name || 'User' },
                });
              } else if (type === 'passwordReset') {
                await emailService.sendPasswordReset({
                  to: user.email,
                  resetToken: data.resetToken || '',
                  name: user.name || 'User',
                });
              } else if (type === 'subscriptionConfirmation') {
                await emailService.sendSubscriptionConfirmation({
                  to: user.email,
                  name: user.name || 'User',
                  plan: data.plan || 'Unknown',
                  amount: data.amount || 0,
                  currency: data.currency || 'USD',
                });
              } else if (type === 'paymentFailure') {
                await emailService.sendPaymentFailure({
                  to: user.email,
                  order: data.order || { _id: 'unknown', totalPrice: 0 },
                  user: { name: user.name || 'User' },
                });
              } else {
                const template = isEmailTemplateType(type)
                  ? emailTemplates[type]
                  : emailTemplates.verification;

                const { subject, html, text } = template(user.name || 'User', data.code || '', data);
                await emailService.send({
                  to: user.email,
                  subject,
                  html,
                  text,
                });
              }
              await sendLog('info', t('Email notification sent'), { userId, notificationId: notification._id, channel });
            }
            break;

          case 'push':
            if (user.fcmToken && (!isSellerSpecific || notificationSettings.pointsNotifications)) {
              await sendPushNotification({
                token: user.fcmToken,
                title,
                body: message,
                data,
              });
              await sendLog('info', t('Push notification sent'), { userId, notificationId: notification._id, channel });
            }
            break;

          case 'sms':
            if (user.phone && (!isSellerSpecific || notificationSettings.sms)) {
              await sendSMS({
                to: user.phone,
                message: `${title}\n\n${message}`,
              });
              await sendLog('info', t('SMS notification sent'), { userId, notificationId: notification._id, channel });
            }
            break;

          case 'whatsapp':
            if (user.phone && (!isSellerSpecific || notificationSettings.sms)) {
              await sendWhatsApp({
                to: user.phone,
                message: `${title}\n\n${message}`,
              });
              await sendLog('info', t('WhatsApp notification sent'), { userId, notificationId: notification._id, channel });
            }
            break;

          case 'in_app':
            user.notifications = user.notifications || [];
            user.notifications.push(notification.toObject());
            await user.save();
            await sendLog('info', t('In-app notification saved'), { userId, notificationId: notification._id, channel });
            break;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : t('Notification error');
        await sendLog('error', t(`${channel} notification error`), { userId, notificationId: notification._id, error: errorMessage });
      }
    });

    await Promise.allSettled(promises);
    await notification.markAsSent();
    await sendLog('info', t('Notification sent successfully'), { userId, notificationId: notification._id });

    return { success: true, notificationId: notification._id.toString() };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : t('Failed to send notification');
    await sendLog('error', t('Notification error'), { userId: options.userId, error: errorMessage });
    return {
      success: false,
      error: errorMessage,
    };
  }
}

export async function sendPushNotification({ token, title, body, data }: PushNotificationOptions) {
  const t = await getTranslations('notifications');
  if (!token) {
    await sendLog('error', t('No push token provided'), {});
    return;
  }

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
          badge: '/icons/icon-512x512.png',
        },
      },
    });
    await sendLog('info', t('Push notification sent'), { token });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : t('Failed to send push notification');
    await sendLog('error', t('Push notification error'), { error: errorMessage });
    throw new Error(t('Failed to send push notification'));
  }
}

export async function sendSMS({ to, message }: SMSOptions) {
  const t = await getTranslations('notifications');
  try {
    const apiKey = process.env.TEXTLOCAL_API_KEY;
    if (!apiKey) {
      await sendLog('error', t('Textlocal API key not configured'), {});
      throw new Error(t('Textlocal API key not configured'));
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
        sender: process.env.TEXTLOCAL_SENDER || 'MGZon',
      }).toString(),
    });

    const result = await response.json();
    if (result.status !== 'success') {
      const errorMessage = result.errors?.[0]?.message || t('Unknown error');
      await sendLog('error', t('Textlocal API error'), { error: errorMessage });
      throw new Error(t('Textlocal API error: {message}', { message: errorMessage }));
    }

    await sendLog('info', t('SMS sent'), { to });
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : t('Failed to send SMS');
    await sendLog('error', t('SMS error'), { error: errorMessage });
    throw new Error(t('Failed to send SMS'));
  }
}

export async function sendWhatsApp({ to, message }: SMSOptions) {
  const t = await getTranslations('notifications');
  try {
    const apiKey = process.env.TEXTLOCAL_API_KEY;
    if (!apiKey) {
      await sendLog('error', t('Textlocal API key not configured'), {});
      throw new Error(t('Textlocal API key not configured'));
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
        sender: process.env.TEXTLOCAL_SENDER || 'MGZon',
        channel: 'whatsapp',
      }).toString(),
    });

    const result = await response.json();
    if (result.status !== 'success') {
      const errorMessage = result.errors?.[0]?.message || t('Unknown error');
      await sendLog('error', t('Textlocal WhatsApp API error'), { error: errorMessage });
      throw new Error(t('Textlocal WhatsApp API error: {message}', { message: errorMessage }));
    }

    await sendLog('info', t('WhatsApp message sent'), { to });
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : t('Failed to send WhatsApp message');
    await sendLog('error', t('WhatsApp error'), { error: errorMessage });
    throw new Error(t('Failed to send WhatsApp message'));
  }
}

export async function checkEmailRateLimit(): Promise<boolean> {
  const t = await getTranslations('notifications');
  try {
    await connectToDatabase();

    const key = `email_rate_limit:${new Date().toISOString().slice(0, 10)}`;
    const limit = parseInt(process.env.EMAIL_RATE_LIMIT || '100');

    let rateLimit = await RateLimit.findOne({ key });

    if (!rateLimit) {
      rateLimit = await RateLimit.create({
        key,
        count: 1,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
      await sendLog('info', t('Email rate limit initialized'), { key });
      return true;
    }

    if (rateLimit.count >= limit) {
      await sendLog('error', t('Email rate limit exceeded'), { key, count: rateLimit.count });
      return false;
    }

    rateLimit.count += 1;
    await rateLimit.save();
    await sendLog('info', t('Email rate limit incremented'), { key, count: rateLimit.count });
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : t('Rate limit check error');
    await sendLog('error', t('Rate limit check error'), { error: errorMessage });
    return false;
  }
}

export async function getUserEmail(userId: string): Promise<string | null> {
  const t = await getTranslations('notifications');
  try {
    const user = await User.findById(userId).select('email');
    await sendLog('info', t('User email fetched'), { userId });
    return user?.email || null;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : t('Failed to fetch user email');
    await sendLog('error', t('Failed to fetch user email'), { userId, error: errorMessage });
    return null;
  }
}

export async function getUserPhone(userId: string): Promise<string | null> {
  const t = await getTranslations('notifications');
  try {
    const user = await User.findById(userId).select('phone');
    await sendLog('info', t('User phone fetched'), { userId });
    return user?.phone || null;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : t('Failed to fetch user phone');
    await sendLog('error', t('Failed to fetch user phone'), { userId, error: errorMessage });
    return null;
  }
}

export async function getUserPushToken(userId: string): Promise<string | null> {
  const t = await getTranslations('notifications');
  try {
    const user = await User.findById(userId).select('pushToken');
    await sendLog('info', t('User push token fetched'), { userId });
    return user?.pushToken || null;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : t('Failed to fetch user push token');
    await sendLog('error', t('Failed to fetch user push token'), { userId, error: errorMessage });
    return null;
  }
}

export async function markAsRead(notificationId: string) {
  const t = await getTranslations('notifications');
  try {
    await connectToDatabase();
    const notification = await Notification.findById(notificationId);
    if (notification) {
      await notification.markAsRead();
      await sendLog('info', t('Notification marked as read'), { notificationId });
    } else {
      await sendLog('error', t('Notification not found'), { notificationId });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : t('Failed to mark notification as read');
    await sendLog('error', t('Failed to mark notification as read'), { notificationId, error: errorMessage });
  }
}

export async function getUnreadCount(userId: string) {
  const t = await getTranslations('notifications');
  try {
    await connectToDatabase();
    const count = await Notification.countDocuments({ userId, read: false });
    await sendLog('info', t('Unread notifications count fetched'), { userId, count });
    return count;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : t('Failed to fetch unread count');
    await sendLog('error', t('Failed to fetch unread count'), { userId, error: errorMessage });
    return 0;
  }
}

export async function getUserNotifications(userId: string, limit = 10, skip = 0) {
  const t = await getTranslations('notifications');
  try {
    await connectToDatabase();
    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    await sendLog('info', t('User notifications fetched'), { userId, limit, skip, count: notifications.length });
    return notifications;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : t('Failed to fetch notifications');
    await sendLog('error', t('Failed to fetch notifications'), { userId, limit, skip, error: errorMessage });
    return [];
  }
}

export async function deleteNotification(notificationId: string) {
  const t = await getTranslations('notifications');
  try {
    await connectToDatabase();
    await Notification.findByIdAndDelete(notificationId);
    await sendLog('info', t('Notification deleted'), { notificationId });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : t('Failed to delete notification');
    await sendLog('error', t('Failed to delete notification'), { notificationId, error: errorMessage });
  }
}

export async function clearAllNotifications(userId: string) {
  const t = await getTranslations('notifications');
  try {
    await connectToDatabase();
    await Notification.deleteMany({ userId });
    await sendLog('info', t('All notifications cleared'), { userId });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : t('Failed to clear notifications');
    await sendLog('error', t('Failed to clear notifications'), { userId, error: errorMessage });
  }
}

export async function markAllAsRead(userId: string) {
  const t = await getTranslations('notifications');
  try {
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
    await sendLog('info', t('All notifications marked as read'), { userId });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : t('Failed to mark all notifications as read');
    await sendLog('error', t('Failed to mark all notifications as read'), { userId, error: errorMessage });
  }
}