import mongoose, { Schema, Document, Model } from 'mongoose';
import crypto from 'crypto';


export interface IAuthCode extends Document {
  code: string;
  clientId: string;
  userId: string;
  redirectUri: string;
  scopes: string[];
  customScopes?: string[];
  expiresAt: Date;
  createdAt: Date;
}

const authCodeSchema = new Schema<IAuthCode>(
  {
    code: {
      type: String,
      required: [true, 'Authorization code is required'],
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
    redirectUri: {
      type: String,
      required: [true, 'Redirect URI is required'],
      validate: {
        validator: (uri: string) => /^https?:\/\/.+$/.test(uri),
        message: 'Invalid redirect URI format',
      },
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
      default: () => new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    },
  },
  {
    timestamps: true,
  }
);

authCodeSchema.index({ code: 1 }, { unique: true });
authCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const AuthCode: Model<IAuthCode> = mongoose.models.AuthCode || mongoose.model<IAuthCode>('AuthCode', authCodeSchema);

export default AuthCode;