import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IClientToken extends Document {
  clientId: string;
  userId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const clientTokenSchema = new Schema<IClientToken>(
  {
    clientId: {
      type: String,
      required: [true, 'Client ID is required'],
      index: true,
    },
    userId: {
      type: String,
      required: [true, 'User ID is required'],
      index: true,
    },
    accessToken: {
      type: String,
      required: [true, 'Access token is required'],
    },
    refreshToken: {
      type: String,
      default: null,
    },
    expiresAt: {
      type: Date,
      required: [true, 'Expires at is required'],
    },
  },
  {
    timestamps: true,
  }
);

const ClientToken: Model<IClientToken> = mongoose.models.ClientToken || mongoose.model<IClientToken>('ClientToken', clientTokenSchema);

export default ClientToken;