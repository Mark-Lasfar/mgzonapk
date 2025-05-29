import { StorageConfig } from '@/types';

// Storage settings for different file types (images, documents, videos, audio)
export const STORAGE_CONFIG = {
  image: {
    maxFileSize: 4 * 1024 * 1024, // 4MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
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
    maxFiles: 1,
    folder: 'documents',
    preserveFilename: true,
  },
  video: {
    maxFileSize: 100 * 1024 * 1024, // 100MB
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
    maxFileSize: 20 * 1024 * 1024, // 20MB
    allowedTypes: ['audio/mpeg', 'audio/wav', 'audio/ogg'],
    maxFiles: 1,
    folder: 'audio',
    maxDuration: 600, // 10 minutes
  },
} as const;

// Folder structure for storage
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

// Notification configuration for different events
export const NOTIFICATION_CONFIG = {
  types: {
    WELCOME: {
      id: 'welcome',
      defaultChannels: ['email'],
      priority: 'high',
      template: 'welcome_email',
      throttle: false,
    },
    ORDER_CREATED: {
      id: 'order_created',
      defaultChannels: ['email', 'push'],
      priority: 'high',
      template: 'order_confirmation',
      throttle: false,
    },
    ORDER_SHIPPED: {
      id: 'order_shipped',
      defaultChannels: ['email', 'push'],
      priority: 'medium',
      template: 'order_shipped',
      throttle: true,
    },
    ORDER_DELIVERED: {
      id: 'order_delivered',
      defaultChannels: ['email', 'push'],
      priority: 'medium',
      template: 'order_delivered',
      throttle: true,
    },
    PAYMENT_SUCCESS: {
      id: 'payment_success',
      defaultChannels: ['email'],
      priority: 'high',
      template: 'payment_success',
      throttle: false,
    },
    PAYMENT_FAILED: {
      id: 'payment_failed',
      defaultChannels: ['email'],
      priority: 'urgent',
      template: 'payment_failed',
      throttle: false,
    },
    RESET_PASSWORD: {
      id: 'reset_password',
      defaultChannels: ['email'],
      priority: 'high',
      template: 'reset_password',
      throttle: false,
      expiry: '1h',
    },
    ACCOUNT_VERIFICATION: {
      id: 'account_verification',
      defaultChannels: ['email'],
      priority: 'high',
      template: 'account_verification',
      throttle: true,
      expiry: '24h',
    },
    SECURITY_ALERT: {
      id: 'security_alert',
      defaultChannels: ['email', 'push', 'sms'],
      priority: 'urgent',
      template: 'security_alert',
      throttle: false,
    },
    POINTS_EARNED: {
      id: 'points_earned',
      defaultChannels: ['email', 'push'],
      priority: 'medium',
      template: 'points_earned',
      throttle: true,
    },
    POINTS_REDEEMED: {
      id: 'points_redeemed',
      defaultChannels: ['email', 'push'],
      priority: 'medium',
      template: 'points_redeemed',
      throttle: true,
    },
    SUBSCRIPTION_UPDATED: {
      id: 'subscription_updated',
      defaultChannels: ['email'],
      priority: 'high',
      template: 'subscription_updated',
      throttle: false,
    },
    SUBSCRIPTION_EXPIRING: {
      id: 'subscription_expiring',
      defaultChannels: ['email', 'in_app'],
      priority: 'high',
      template: 'subscription_expiring',
      throttle: true,
    },
    SUBSCRIPTION_EXPIRED: {
      id: 'subscription_expired',
      defaultChannels: ['email', 'in_app'],
      priority: 'urgent',
      template: 'subscription_expired',
      throttle: false,
    },
    PRODUCT_REVIEWED: {
      id: 'product_reviewed',
      defaultChannels: ['email', 'in_app'],
      priority: 'medium',
      template: 'product_reviewed',
      throttle: true,
    },
    CART_UPDATED: {
      id: 'cart_updated',
      defaultChannels: ['email', 'in_app'],
      priority: 'medium',
      template: 'cart_updated',
      throttle: true,
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
    },
  },
  templates: {
    path: 'emails',
    defaultLocale: 'en',
    supportedLocales: ['en', 'es', 'fr', 'ar'],
    fallbackLocale: 'en',
  },
  retention: {
    read: 30, // days
    unread: 90, // days
    failed: 7, // days
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

// Type exports
export type NotificationConfigType = typeof NOTIFICATION_CONFIG;
export type StorageFoldersType = typeof STORAGE_FOLDERS;
export type StorageConfigType = typeof STORAGE_CONFIG;

// File size units and allowed extensions
export const FILE_SIZE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;
export const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'] as const;
export const ALLOWED_DOCUMENT_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv'] as const;
export const ALLOWED_VIDEO_EXTENSIONS = ['.mp4', '.webm'] as const;
export const ALLOWED_AUDIO_EXTENSIONS = ['.mp3', '.wav', '.ogg'] as const;

// Access levels for storage
export const ACCESS_LEVELS = {
  PUBLIC: 'public',
  PRIVATE: 'private',
  RESTRICTED: 'restricted',
} as const;

// Cache settings for different file types
export const CACHE_CONFIG = {
  images: {
    maxAge: '1y',
    immutable: true,
  },
  documents: {
    maxAge: '1d',
    immutable: false,
  },
  temp: {
    maxAge: '1h',
    immutable: false,
  },
} as const;