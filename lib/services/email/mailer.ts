import nodemailer from 'nodemailer';
import { EMAIL_CONFIG } from '@/lib/config/email';
import { logger } from '@/lib/api/services/logging';
import crypto from 'crypto';
import { Data } from '@/types';

// تعريف الأنواع
interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

interface Order {
  _id: string;
  items: OrderItem[];
  totalPrice: number;
}

interface User {
  name: string;
}

interface EmailMetadata {
  timestamp: string;
  user: string;
  requestId: string;
}

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: EMAIL_CONFIG.SMTP.USER,
        pass: EMAIL_CONFIG.SMTP.PASS?.replace(/\s/g, ''),
      },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      secure: true,
      port: 465,
      debug: process.env.NODE_ENV === 'development',
      logger: process.env.NODE_ENV === 'development',
    });

    this.verifyConnection();
  }

  private formatDate(date: Date): string {
    return date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
  }

  private getMetadata(): EmailMetadata {
    return {
      timestamp: this.formatDate(new Date()),
      user: process.env.CURRENT_USER || 'system',
      requestId: crypto.randomUUID(),
    };
  }

  private async verifyConnection() {
    try {
      const isReady = await this.transporter.verify();
      const metadata = this.getMetadata();

      logger.info('SMTP Connection Status', {
        ready: isReady,
        email: EMAIL_CONFIG.SMTP.USER,
        host: EMAIL_CONFIG.SMTP.HOST,
        metadata: {
          service: 'api',
          ...metadata,
        },
      });
    } catch (error) {
      const metadata = this.getMetadata();

      logger.error('SMTP Connection Error', {
        error: error instanceof Error ? error.message : String(error),
        email: EMAIL_CONFIG.SMTP.USER,
        host: EMAIL_CONFIG.SMTP.HOST,
        metadata: {
          service: 'api',
          ...metadata,
        },
      });
    }
  }

  private async send(options: EmailOptions) {
    const startTime = Date.now();
    const metadata = this.getMetadata();

    try {
      const result = await this.transporter.sendMail({
        from: `"${EMAIL_CONFIG.FROM.NAME}" <${EMAIL_CONFIG.FROM.EMAIL}>`,
        ...options,
      });

      logger.info('Email sent successfully', {
        messageId: result.messageId,
        to: options.to,
        subject: options.subject,
        duration: Date.now() - startTime,
        metadata: {
          service: 'api',
          ...metadata,
        },
      });

      return result;
    } catch (error) {
      logger.error('Failed to send email', {
        error: error instanceof Error
          ? {
              message: error.message,
              name: error.name,
              stack: error.stack,
            }
          : String(error),
        to: options.to,
        subject: options.subject,
        duration: Date.now() - startTime,
        metadata: {
          service: 'api',
          ...metadata,
        },
        smtp: {
          user: EMAIL_CONFIG.SMTP.USER,
          host: EMAIL_CONFIG.SMTP.HOST,
        },
      });
      throw error;
    }
  }

  public async sendVerificationCode(options: {
    to: string;
    code: string;
    name: string;
  }) {
    const metadata = this.getMetadata();

    return this.send({
      to: options.to,
      subject: EMAIL_CONFIG.TEMPLATES.VERIFICATION.SUBJECT,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333; text-align: center;">Email Verification</h1>
          <p>Hello ${options.name},</p>
          <p>Please use the following code to verify your email address:</p>
          <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 24px; letter-spacing: 5px; margin: 20px 0; border-radius: 5px;">
            <strong>${options.code}</strong>
          </div>
          <p>This code will expire in 10 minutes.</p>
          <p>If you didn't request this code, please ignore this email.</p>
          <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #666;">
            <p>This is an automated message from MGZon</p>
            <p>Sent at: ${metadata.timestamp}</p>
          </div>
        </div>
      `,
      text: `
        Hello ${options.name},

        Please use the following code to verify your email address:

        ${options.code}

        This code will expire in 10 minutes.

        If you didn't request this code, please ignore this email.

        MGZon
        Sent at: ${metadata.timestamp}
      `,
    });
  }

  public async sendOrderConfirmation(options: {
    to: string;
    order: Order;
    user: User;
  }) {
    const metadata = this.getMetadata();

    return this.send({
      to: options.to,
      subject: EMAIL_CONFIG.TEMPLATES.ORDER_CONFIRMATION.SUBJECT,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1>Order Confirmation</h1>
          <p>Thank you for your order, ${options.user.name}!</p>
          <p>Order #${options.order._id}</p>
          <div style="margin: 20px 0;">
            ${options.order.items
              .map(
                (item) => `
              <div style="padding: 10px; border-bottom: 1px solid #eee;">
                <p>${item.name} x ${item.quantity} - $${(item.price * item.quantity).toFixed(2)}</p>
              </div>
            `
              )
              .join('')}
          </div>
          <p><strong>Total:</strong> $${options.order.totalPrice.toFixed(2)}</p>
          <p>Sent at: ${metadata.timestamp}</p>
        </div>
      `,
      text: `
        Order Confirmation

        Thank you for your order, ${options.user.name}!
        Order #${options.order._id}

        ${options.order.items
          .map(
            (item) =>
              `${item.name} x ${item.quantity} - $${(item.price * item.quantity).toFixed(2)}`
          )
          .join('\n')}

        Total: $${options.order.totalPrice.toFixed(2)}
        
        Sent at: ${metadata.timestamp}
      `,
    });
  }

  public async sendPasswordReset(options: {
    to: string;
    resetToken: string;
    name: string;
  }) {
    const metadata = this.getMetadata();

    return this.send({
      to: options.to,
      subject: EMAIL_CONFIG.TEMPLATES.PASSWORD_RESET.SUBJECT,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1>Password Reset</h1>
          <p>Hello ${options.name},</p>
          <p>Click the button below to reset your password:</p>
          <div style="text-align: center; margin: 20px 0;">
            <a href="${process.env.NEXT_PUBLIC_BASE_URL}/reset-password/${options.resetToken}"
               style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              Reset Password
            </a>
          </div>
          <p>If you didn't request this, please ignore this email.</p>
          <p style="color: #666; text-align: center; margin-top: 20px;">
            Sent at: ${metadata.timestamp}
          </p>
        </div>
      `,
      text: `
        Password Reset

        Hello ${options.name},

        Click the link below to reset your password:
        ${process.env.NEXT_PUBLIC_BASE_URL}/reset-password/${options.resetToken}

        If you didn't request this, please ignore this email.
        
        Sent at: ${metadata.timestamp}
      `,
    });
  }

  public async sendSubscriptionConfirmation(options: {
    to: string;
    name: string;
    plan: string;
    amount: number;
    currency: string;
    email:string;
    // market: string;
  }) {
    const metadata = this.getMetadata();

    return this.send({
      to: options.to,
      subject: 'Subscription Confirmation - MGZon',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333; text-align: center;">Subscription Confirmed</h1>
          <p>Hello ${options.name},</p>
          <p>Thank you for subscribing to the ${options.plan} plan!</p>
          <p><strong>Amount:</strong> ${options.amount} ${options.currency}</p>
          <p>Your account is now active. Start selling today!</p>
          <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #666;">
            <p>This is an automated message from MGZon</p>
            <p>Sent at: ${metadata.timestamp}</p>
          </div>
        </div>
      `,
      text: `
        Subscription Confirmed

        Hello ${options.name},

        Thank you for subscribing to the ${options.plan} plan!
        Amount: ${options.amount} ${options.currency}

        Your account is now active. Start selling today!

        MGZon
        Sent at: ${metadata.timestamp}
      `,
    });
  }
}

// تصدير نسخة واحدة من الخدمة
export const emailService = new EmailService();