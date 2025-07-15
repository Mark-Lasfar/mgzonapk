"use server";

import { connectToDatabase } from "@/lib/db";
import Notification, { NotificationType, NotificationChannel, NotificationPriority } from "../db/models/notification.model";
import User from "@/lib/db/models/user.model";
import Seller from "@/lib/db/models/seller.model";
import { NOTIFICATION_CONFIG } from "@/lib/config/storage.config";
import { TFunction } from "i18next";
import { IProduct } from "@/types";
import { checkEmailRateLimit, sendEmail, sendPushNotification, sendSMS, getEmailTemplate } from "@/lib/utils/notification";
import Product from "../db/models/product.model";

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
      channels = NOTIFICATION_CONFIG.types[type.toUpperCase()]?.defaultChannels || ["email"],
      priority = NOTIFICATION_CONFIG.types[type.toUpperCase()]?.priority || "medium",
      expiresAt,
      metadata,
    } = options;

    const seller = await Seller.findOne({ userId });
    const notificationSettings = seller?.settings.notifications || {
      email: true,
      sms: false,
      orderUpdates: true,
      marketingEmails: false,
      pointsNotifications: true,
    };

    const allowedChannels = channels.filter((channel) => {
      if (channel === "email" && !notificationSettings.email) return false;
      if (channel === "sms" && !notificationSettings.sms) return false;
      if (channel === "in_app") return true;
      if (channel === "push" && notificationSettings.pointsNotifications) return true;
      return true;
    });

    if (allowedChannels.length === 0) {
      return { success: true, notificationId: null, message: "No allowed channels" };
    }

    const user = await User.findById(userId).select("email phone fcmToken locale");
    if (!user) throw new Error("User not found");

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
      status: "pending",
      read: false,
    });

    const promises = allowedChannels.map(async (channel) => {
      try {
        switch (channel) {
          case "email":
            if (user.email && notificationSettings.email) {
              const canSendEmail = await checkEmailRateLimit();
              if (!canSendEmail) {
                await Notification.findByIdAndUpdate(notification._id, {
                  status: "queued",
                  queuedAt: new Date(),
                });
                return;
              }
              await sendEmail({
                to: user.email,
                subject: title,
                html: getEmailTemplate(type, title, message, data, user.locale || "en"),
                data,
              });
            }
            break;
          case "push":
            if (user.fcmToken && notificationSettings.pointsNotifications) {
              await sendPushNotification({
                token: user.fcmToken,
                title,
                body: message,
                data,
              });
            }
            break;
          case "sms":
            if (user.phone && notificationSettings.sms) {
              await sendSMS({
                to: user.phone,
                message: `${title}: ${message}`,
              });
            }
            break;
          case "in_app":
            user.notifications = user.notifications || [];
            user.notifications.push(notification);
            await user.save();
            break;
        }
      } catch (error) {
        console.error(`${channel} notification error:`, error);
      }
    });

    await Promise.allSettled(promises);
    await notification.markAsSent();

    return { success: true, notificationId: notification._id };
  } catch (error) {
    console.error("Notification error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send notification",
    };
  }
}

export interface CartItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
}

export async function addToCart(
  userId: string,
  product: IProduct,
  quantity: number,
  t: TFunction
): Promise<{ success: boolean; message?: string; cartItem?: CartItem }> {
  try {
    await connectToDatabase();

    if (product.countInStock < quantity) {
      return { success: false, message: t("insufficientStock") };
    }

    const cartItem: CartItem = {
      productId: product._id,
      name: product.name,
      quantity,
      price: product.pricing.finalPrice,
    };

    await sendNotification({
      userId,
      type: "cart updated",
      title: t("cartUpdatedTitle"),
      message: t("cartUpdatedMessage", { productName: product.name }),
      channels: ["in_app", "email"],
      data: { productId: product._id, quantity },
    });

    await Product.findByIdAndUpdate(product._id, {
      $inc: { countInStock: -quantity },
    });

    return { success: true, cartItem };
  } catch (error) {
    console.error("Add to cart error:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : t("addToCartFailed"),
    };
  }
}