import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IOAuthState extends Document {
  state: string;
  providerId: string;
  sellerId: string;
  sandbox: boolean;
  createdAt: Date;
}

const oauthStateSchema = new Schema<IOAuthState>(
  {
    state: { type: String, required: true, unique: true, index: true },
    providerId: { type: String, required: true },
    sellerId: { type: String, required: true },
    sandbox: { type: Boolean, default: false },
  },
  { timestamps: true }
);

oauthStateSchema.index({ createdAt: 1 }, { expireAfterSeconds: 600 });

const OAuthState: Model<IOAuthState> =
  mongoose.models.OAuthState || mongoose.model('OAuthState', oauthStateSchema);

export default OAuthState;