// /home/mark/Music/my-nextjs-project-clean/lib/db/models/user.model.ts

import { Document, Model, model, models, Schema } from 'mongoose';
import { IUserInput , Notification } from '@/lib/types';
export interface IUser extends Document, IUserInput {
  _id: string;
  password?: string;
  emailVerified: boolean;
  isActive: boolean;
  lastLogin?: Date;
  businessProfile?: string;
  notifications: Notification[];
  fcmToken?: string;
  phone?: string;
  locale: string;
  timezone?: string;
  apiKeys?: string[];
  pointsBalance: number;
  createdAt: Date;
  updatedAt: Date;
  email: string;
  pushToken?: string;
  whatsapp?: string;
  nickname?: string;
    mgzonId?: string;

}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/, 'Please enter a valid email address'],
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
    },
    phone: {
      type: String,
      trim: true,
      match: [/^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/, 'Please enter a valid phone number'],
      required: false,
    },
        mgzonId: {
      type: String,
      sparse: true,
    },
    profile: {
      nickname: {
        type: String,
        unique: true,
        sparse: true,
        trim: true,
      },
      avatar: String,
      status: String,
      jobTitle: String,
      bio: String,
      phone: String,
      socialLinks: {
        linkedin: String,
        behance: String,
        github: String,
        whatsapp: String,
      },
      education: [
        {
          institution: String,
          degree: String,
          year: String,
        },
      ],
      experience: [
        {
          company: String,
          role: String,
          duration: String,
        },
      ],
      certificates: [
        {
          name: String,
          issuer: String,
          year: String,
        },
      ],
      skills: [
        {
          name: String,
          percentage: Number,
        },
      ],
      projects: [
        {
          title: String,
          description: String,
          image: String,
          links: [
            {
              option: String,
              value: String,
            },
          ],
        },
      ],
      interests: [String],
      isPublic: {
        type: Boolean,
        default: true,
      },
      customFields: [
        {
          key: String,
          value: String,
        },
      ],
      avatarDisplayType: {
        type: String,
        enum: ['svg', 'normal'],
        default: 'normal',
      },
      svgColor: {
        type: String,
        default: '#000000',
      },
      portfolioName: {
        type: String,
        default: 'Portfolio',
      },
    },
        refreshTokens: [
      {
        token: String,
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    role: {
      type: String,
      required: [true, 'Role is required'],
      default: 'user',
      enum: {
        values: ['user', 'Admin', 'SELLER'],
        message: '{VALUE} is not a valid role',
      },
    },
    password: {
      type: String,
      select: false,
    },
    image: {
      type: String,
      trim: true,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    pushToken: { type: String },
    whatsapp: { type: String },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
    },
    businessProfile: {
      type: Schema.Types.ObjectId,
      ref: 'Seller',
      default: null,
    },
    notifications: [
      {
        type: {
          type: String,
          required: [true, 'Notification type is required'],
        },
        title: {
          type: String,
          required: [true, 'Notification title is required'],
          trim: true,
        },
        message: {
          type: String,
          required: [true, 'Notification message is required'],
          trim: true,
        },
        data: {
          type: Schema.Types.Mixed,
        },
        channels: [
          {
            type: String,
            enum: {
              values: ['email', 'push', 'sms', 'in_app'],
              message: '{VALUE} is not a valid channel',
            },
            required: true,
          },
        ],
        priority: {
          type: String,
          enum: {
            values: ['low', 'medium', 'high', 'urgent'],
            message: '{VALUE} is not a valid priority',
          },
          default: 'medium',
        },
        status: {
          type: String,
          enum: {
            values: ['pending', 'sent', 'failed', 'queued', 'read'],
            message: '{VALUE} is not a valid status',
          },
          default: 'pending',
        },
        expiresAt: {
          type: Date,
        },
        metadata: {
          browser: { type: String, trim: true },
          device: { type: String, trim: true },
          ip: { type: String, trim: true },
        },
        read: {
          type: Boolean,
          default: false,
        },
        readAt: {
          type: Date,
        },
        queuedAt: {
          type: Date,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
        updatedAt: {
          type: Date,
          default: Date.now,
        },
        _id: false,
      },
    ],
    fcmToken: {
      type: String,
      trim: true,
    },
    locale: {
      type: String,
      default: 'en',
      trim: true,
    },
    timezone: {
      type: String,
      trim: true,
      default: 'UTC',
    },
    apiKeys: [
      {
        type: Schema.Types.ObjectId,
        ref: 'ApiKey',
      },
    ],
    pointsBalance: {
      type: Number,
      default: 0,
    },
    nickname: {
      type: String,
      trim: true,
      minlength: [2, 'Nickname must be at least 2 characters'],
    },
  },
  {
    timestamps: true,
  }
);

userSchema.index({ role: 1 });
userSchema.index({ 'profile.nickname': 1 }, { unique: true, sparse: true });
userSchema.index({ createdAt: 1 });
userSchema.index({ 'notifications.status': 1 });
userSchema.index({ fcmToken: 1 });

userSchema.pre('save', function (next) {
  if (this.isModified('email')) {
    this.email = this.email.toLowerCase().trim();
  }
  if (this.isModified('name')) {
    this.name = this.name.trim();
  }
  if (this.isModified('phone')) {
    this.phone = this.phone?.trim();
  }
  if (this.isModified('nickname')) {
    this.nickname = this.nickname?.trim();
  }
  next();
});

const User = models.User || model<IUser>('User', userSchema);
export default User as Model<IUser>;