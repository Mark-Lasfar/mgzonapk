import mongoose, { Schema, Document, Model } from 'mongoose';
import { DynamicSettings } from '@/lib/types/settings';

export interface ISettings extends Document, DynamicSettings {
  env: 'live' | 'sandbox';
}

const SettingsSchema: Schema<ISettings> = new Schema({
  env: {
    type: String,
    enum: ['live', 'sandbox'],
    required: true,
  },
  email: { type: String, required: true },
  notifications: {
    email: { type: Boolean, default: true },
    sms: { type: Boolean, default: false },
    orderUpdates: { type: Boolean, default: true },
    marketingEmails: { type: Boolean, default: false },
    pointsNotifications: { type: Boolean, default: true },
  },
  display: {
    showRating: { type: Boolean, default: true },
    showContactInfo: { type: Boolean, default: true },
    showMetrics: { type: Boolean, default: true },
    showPointsBalance: { type: Boolean, default: true },
  },
  security: {
    twoFactorAuth: { type: Boolean, default: false },
    loginNotifications: { type: Boolean, default: true },
  },
  customSite: {
    theme: { type: String, default: 'default' },
    primaryColor: { type: String, default: '#000000' },
  },
  shippingOptions: [{ type: Schema.Types.Mixed }],
  discountOffers: [{ type: Schema.Types.Mixed }],
  paymentGateways: [{ type: Schema.Types.Mixed }],
});

const Settings: Model<ISettings> = mongoose.models.Settings || mongoose.model<ISettings>('Settings', SettingsSchema);
export default Settings;