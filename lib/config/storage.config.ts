// /lib/config/storage.config.ts
import { connectToDatabase } from '@/lib/db';
import Seller from '@/lib/db/models/seller.model';
import { StorageConfig, NotificationConfig } from '@/types';


export async function getStorageConfig(sellerId?: string): Promise<StorageConfig> {
  await connectToDatabase();
  const baseConfig: StorageConfig = {
    products: {
      provider: process.env.DEFAULT_STORAGE_PROVIDER || 'cloudinary',
      config: {},
    },
    image: {
      maxFileSize: 5 * 1024 * 1024, // تغيير إلى 5MB
      allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
      maxFiles: 4,
      folder: 'images',
      compressionQuality: 80,
      dimensions: {
        thumbnail: { width: 150, height: 150 },
        small: { width: 300, height: 300 },
        medium: { width: 600, height: 600 },
        large: { width: 1200, height: 1200 },
      },
      aspectRatios: ['1:1', '4:3', '16:9'],
    },
    document: {
      maxFileSize: Number(process.env.DOCUMENT_MAX_FILE_SIZE) || 8 * 1024 * 1024, // 8MB
      allowedTypes: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
        'text/csv',
      ],
      maxFiles: 5,
      folder: 'documents',
      preserveFilename: true,
    },
    video: {
      maxFileSize: Number(process.env.VIDEO_MAX_FILE_SIZE) || 100 * 1024 * 1024, // 100MB
      allowedTypes: ['video/mp4', 'video/webm'],
      maxFiles: 1,
      folder: 'videos',
      maxDuration: 300, // 5 minutes
      transcoding: {
        formats: ['mp4', 'webm'],
        qualities: ['720p', '480p', '360p'],
        thumbnailTime: '00:00:01',
      },
    },
    audio: {
      maxFileSize: Number(process.env.AUDIO_MAX_FILE_SIZE) || 20 * 1024 * 1024, // 20MB
      allowedTypes: ['audio/mpeg', 'audio/wav', 'audio/ogg'],
      maxFiles: 1, // Fixed: Changed from number[] to number
      folder: 'audio',
      maxDuration: 600, // 10 minutes
    },
  };

  if (!sellerId) return baseConfig;

  const seller = await Seller.findById(sellerId);
  if (!seller) return baseConfig;

  return {
    ...baseConfig,
    products: {
      provider: seller.integrations.storage?.providerName || baseConfig.products.provider,
      config: seller.integrations.storage?.metadata || {},
    },
    image: {
      ...baseConfig.image,
      folder: `sellers/${sellerId}/images`,
    },
    document: {
      ...baseConfig.document,
      folder: `sellers/${sellerId}/documents`,
    },
    video: {
      ...baseConfig.video,
      folder: `sellers/${sellerId}/videos`,
    },
    audio: {
      ...baseConfig.audio,
      folder: `sellers/${sellerId}/audio`,
    },
  };
}

// Static STORAGE_CONFIG for default usage

export const STORAGE_CONFIG: StorageConfig = {
  products: {
    provider: process.env.DEFAULT_STORAGE_PROVIDER || 'cloudinary',
    config: {},
  },
  image: {
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
    maxFiles: 4,
    folder: 'images',
    compressionQuality: 80,
    dimensions: {
      thumbnail: { width: 150, height: 150 },
      small: { width: 300, height: 300 },
      medium: { width: 600, height: 600 },
      large: { width: 1200, height: 1200 },
    },
    aspectRatios: ['1:1', '4:3', '16:9'],
  },
  document: {
    maxFileSize: 8 * 1024 * 1024, // 8MB
    allowedTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv',
    ],
    maxFiles: 5,
    folder: 'documents',
    preserveFilename: true,
  },
  video: {
    maxFileSize: 100 * 1024 * 1024, // 100MB
    allowedTypes: ['video/mp4', 'video/webm'],
    maxFiles: 1, // Fixed: Changed from number[] to number
    folder: 'videos',
    maxDuration: 300, // 5 minutes
    transcoding: {
      formats: ['mp4', 'webm'],
      qualities: ['720p', '480p', '360p'],
      thumbnailTime: '00:00:01',
    },
  },
  audio: {
    maxFileSize: 20 * 1024 * 1024, // 20MB
    allowedTypes: ['audio/mpeg', 'audio/wav', 'audio/ogg'],
    maxFiles: 1, // Fixed: Changed from number[] to number
    folder: 'audio',
    maxDuration: 600, // 10 minutes
  },
};

// Storage folders configuration
export const STORAGE_FOLDERS = {
  products: {
    path: 'products',
    subFolders: {
      images: 'images',
      thumbnails: 'thumbnails',
      variants: 'variants',
      documents: 'documents',
      videos: 'videos',
    },
    access: 'public',
  },
  users: {
    path: 'users',
    subFolders: {
      avatars: 'avatars',
      documents: 'documents',
      verifications: 'verifications',
    },
    access: 'private',
  },
  categories: {
    path: 'categories',
    subFolders: {
      icons: 'icons',
      banners: 'banners',
      thumbnails: 'thumbnails',
    },
    access: 'public',
  },
  orders: {
    path: 'orders',
    subFolders: {
      invoices: 'invoices',
      receipts: 'receipts',
      attachments: 'attachments',
    },
    access: 'private',
  },
  blog: {
    path: 'blog',
    subFolders: {
      images: 'images',
      thumbnails: 'thumbnails',
      attachments: 'attachments',
    },
    access: 'public',
  },
  support: {
    path: 'support',
    subFolders: {
      tickets: 'tickets',
      attachments: 'attachments',
    },
    access: 'private',
  },
  temp: {
    path: 'temp',
    subFolders: {
      uploads: 'uploads',
      processing: 'processing',
    },
    retention: '24h',
    access: 'private',
  },
} as const;

// Notification configuration
export const NOTIFICATION_CONFIG: NotificationConfig = {
  types: {
    welcome: {
      id: 'welcome',
      defaultChannels: ['email'],
      priority: 'high',
      template: 'welcome email',
      throttle: false,
    },
    order_created: {
      id: 'order created',
      defaultChannels: ['email', 'push'],
      priority: 'high',
      template: 'order.confirmation',
      throttle: false,
    },
    order_shipped: {
      id: 'order.shipped',
      defaultChannels: ['email', 'push'],
      priority: 'medium',
      template: 'order.shipped',
      throttle: true,
    },
    order_delivered: {
      id: 'order delivered',
      defaultChannels: ['email', 'push'],
      priority: 'medium',
      template: 'order delivered',
      throttle: true,
    },
    payment_success: {
      id: 'payment success',
      defaultChannels: ['email'],
      priority: 'high',
      template: 'payment_success',
      throttle: false,
    },
    payment_failed: {
      id: 'payment failed',
      defaultChannels: ['email'],
      priority: 'urgent',
      template: 'payment.failed',
      throttle: false,
    },
    reset_password: {
      id: 'reset password',
      defaultChannels: ['email'],
      priority: 'high',
      template: 'reset password',
      throttle: false,
      expiry: '1h',
    },
    account_verification: {
      id: 'account verification',
      defaultChannels: ['email'],
      priority: 'high',
      template: 'account verification',
      throttle: true,
      expiry: '24h',
    },
    security_alert: {
      id: 'security alert',
      defaultChannels: ['email', 'push', 'sms'],
      priority: 'urgent',
      template: 'security alert',
      throttle: false,
    },
    points_earned: {
      id: 'points earned',
      defaultChannels: ['email', 'push'],
      priority: 'medium',
      template: 'points earned',
      throttle: true,
    },
    points_redeemed: {
      id: 'points redeemed',
      defaultChannels: ['email', 'push'],
      priority: 'medium',
      template: 'points redeemed',
      throttle: true,
    },
    subscription_updated: {
      id: 'subscription_updated',
      defaultChannels: ['email'],
      priority: 'high',
      template: 'subscription_updated',
      throttle: false,
    },
    subscription_expiring: {
      id: 'subscription_expiring',
      defaultChannels: ['email', 'in_app'],
      priority: 'high',
      template: 'subscription_expiring',
      throttle: true,
    },
    subscription_expired: {
      id: 'subscription expired',
      defaultChannels: ['email', 'in_app'],
      priority: 'urgent',
      template: 'subscription expired',
      throttle: false,
    },
    product_reviewed: {
      id: 'product reviewed',
      defaultChannels: ['email', 'in_app'],
      priority: 'medium',
      template: 'product reviewed',
      throttle: true,
    },
    cart_updated: {
      id: 'cart updated',
      defaultChannels: ['email', 'in_app'],
      priority: 'medium',
      template: 'cart_updated',
      throttle: true,
    },
    api_key_created: {
      id: 'api_key_created',
      defaultChannels: ['email', 'in_app'],
      priority: 'high',
      template: 'api_key_created',
      throttle: false,
    },
  },
  channels: {
    email: {
      enabled: true,
      provider: 'resend',
      rateLimits: {
        perMinute: 60,
        perHour: 500,
        perDay: 5000,
      },
      retries: {
        maxAttempts: 3,
        backoff: 'exponential',
      },
    },
    push: {
      enabled: true,
      provider: 'firebase',
      rateLimits: {
        perMinute: 100,
        perHour: 1000,
        perDay: 10000,
      },
      retries: {
        maxAttempts: 2,
        backoff: 'linear',
      },
    },
    sms: {
      enabled: false,
      provider: 'twilio',
      rateLimits: {
        perMinute: 30,
        perHour: 200,
        perDay: 1000,
      },
      retries: {
        maxAttempts: 2,
        backoff: 'fixed',
      },
    },
    in_app: {
      enabled: true,
      provider: 'internal',
      rateLimits: {
        perMinute: 100,
        perHour: 1000,
        perDay: 10000,
      },
      retries: {
        maxAttempts: 0,
        backoff: '',
      },
    },
  },
  templates: {
    path: './templates/emails',
    defaultLocale: 'en',
    supportedLocales: ['en', 'es', 'fr', 'ar'],
    fallbackLocale: 'en',
  },
  retention: {
    email: {
      read: 30,
      unread: 90,
      failed: 7,
    },
    push: {
      read: 30,
      unread: 7,
      failed: 1,
    },
    sms: {
      read: 7,
      unread: 30,
      failed: 7,
    },
    in_app: {
      read: 30,
      unread: 90,
      failed: 7,
    },
  },
  throttling: {
    enabled: true,
    window: '1h',
    maxAttempts: 5,
  },
  delivery: {
    retryStrategy: 'exponential',
    maxRetries: 3,
    timeout: '30s',
  },
} as const;

// File size units and allowed extensions
export const FILE_SIZE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;
export const ALLOWED_EXTENSIONS = {
  image: ['.jpg', '.jpeg', '.png', '.webp'] as const,
  document: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv'] as const,
  video: ['.mp4', '.webm'] as const,
  audio: ['.mp3', '.mpeg', '.wav', '.ogg'] as const,
};

// Access levels
export const ACCESS_LEVELS = {
  PUBLIC: 'public',
  PRIVATE: 'private',
  RESTRICTED: 'restricted',
} as const;

// Cache configuration
export const CACHE_CONFIG = {
  images: {
    maxAge: '1y',
    immutable: true,
    cdn: 'cloudfront',
  },
  documents: {
    maxAge: '1d',
    immutable: false,
    cdn: 'cloudfront',
  },
  temp: {
    maxAge: '1h',
    immutable: false,
    cdn: 'none',
  },
} as const;

export type StorageConfigType = StorageConfig;
export type NotificationConfigType = typeof NOTIFICATION_CONFIG;
export type StorageFoldersType = typeof STORAGE_FOLDERS;