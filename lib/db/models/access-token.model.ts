import mongoose, { Schema, Document, Model } from 'mongoose';
import crypto from 'crypto';

export interface IAccessToken extends Document {
  accessToken: string;
  refreshToken: string;
  clientId: string;
  userId: string;
  scopes: string[];
  customScopes?: string[];
  expiresAt: Date;
  createdAt: Date;
}

const accessTokenSchema = new Schema<IAccessToken>(
  {
    accessToken: {
      type: String,
      required: [true, 'Access token is required'],
      unique: true,
      default: () => crypto.randomBytes(32).toString('hex'),
    },
    refreshToken: {
      type: String,
      required: [true, 'Refresh token is required'],
      unique: true,
      default: () => crypto.randomBytes(32).toString('hex'),
    },
    clientId: {
      type: String,
      required: [true, 'Client ID is required'],
    },
    userId: {
      type: String,
      required: [true, 'User ID is required'],
    },
    scopes: [
      {
        type: String,
        required: [true, 'Scope is required'],
        enum: {
          values: [
            'profile:read',
            'profile:write',
            'products:read',
            'products:write',
            'orders:read',
            'orders:write',
            'customers:read',
            'customers:write',
            'inventory:read',
            'inventory:write',
            'analytics:read',
          ],
          message: 'Invalid scope: {VALUE}',
        },
      },
    ],
    customScopes: [
      {
        type: String,
        trim: true,
        validate: {
          validator: (scope: string) => /^[a-zA-Z0-9:]+$/.test(scope),
          message: 'Invalid custom scope format',
        },
      },
    ],
    expiresAt: {
      type: Date,
      required: [true, 'Expiration date is required'],
      default: () => new Date(Date.now() + 3600 * 1000), // 1 hour
    },
  },
  {
    timestamps: true,
  }
);

accessTokenSchema.index({ accessToken: 1 }, { unique: true });
accessTokenSchema.index({ refreshToken: 1 }, { unique: true });
accessTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const AccessToken: Model<IAccessToken> = mongoose.models.AccessToken || mongoose.model<IAccessToken>('AccessToken', accessTokenSchema);

export default AccessToken;