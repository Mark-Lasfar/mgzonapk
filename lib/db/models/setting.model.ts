// /lib/db/models/setting.model.ts
import { ISettingInput } from '@/types';
import { Document, Model, model, models, Schema } from 'mongoose';

export interface ISetting extends Document, ISettingInput {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
}

const settingSchema = new Schema<ISetting>(
  {
    common: {
      pageSize: { type: Number, required: true, default: 9 },
      isMaintenanceMode: { type: Boolean, required: true, default: false },
      freeShippingMinPrice: { type: Number, required: true, default: 0 },
      defaultTheme: { type: String, required: true, default: 'light' },
      defaultColor: { type: String, required: true, default: 'gold' },
      featuredCategories: { type: [String], required: true, default: [] },
    },
    site: {
      name: { type: String, required: true },
      url: { type: String, required: true },
      logo: { type: String, required: true },
      slogan: { type: String, required: true },
      description: { type: String, required: true },
      keywords: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String, required: true },
      author: { type: String, required: true },
      copyright: { type: String, required: true },
      address: { type: String, required: true },
    },
    seo: {
      metaTitle: { type: String, required: true, default: 'MGZon' },
      metaDescription: { 
        type: String, 
        required: true, 
        default: 'Shop online for the best products at great prices' 
      },
      keywords: { type: String, required: true, default: 'ecommerce, shopping' },
      ogImage: { type: String, default: '/icons/og-image.jpg' },
      robots: { type: String, default: 'index, follow' },
    },
    
    points: {
      earnRate: { type: Number, required: true, default: 1 },
      redeemValue: { type: Number, required: true, default: 0.05 },
      registrationBonus: {
        buyer: { type: Number, required: true, default: 50 },
        seller: { type: Number, required: true, default: 100 },
      },
      sellerPointsPerSale: { type: Number, required: true, default: 10 },
      enabled: { type: Boolean, required: true, default: true },
      rate: { type: Number, required: true, default: 1 },
    },

    // إعدادات الاشتراكات الجديدة
    subscriptions: {
      enabled: { type: Boolean, required: true, default: true },
      trialPeriodDays: { type: Number, required: true, default: 14 },
      autoRenew: { type: Boolean, required: true, default: true },
      
      // خطط الاشتراكات
      plans: [{
        name: { type: String, required: true },
        slug: { type: String, required: true, unique: true },
        description: { type: String, required: true },
        price: { type: Number, required: true, default: 0 },
        currency: { type: String, required: true, default: 'USD' },
        duration: { 
          type: Number, 
          required: true, 
          enum: [1, 3, 6, 12], // أشهر
          default: 1 
        },
        durationType: { 
          type: String, 
          required: true, 
          enum: ['month', 'year'], 
          default: 'month' 
        },
        features: [{
          name: { type: String, required: true },
          value: { type: String, required: true },
          description: { type: String }
        }],
        maxProducts: { type: Number, default: 0 }, // 0 = غير محدود
        maxOrders: { type: Number, default: 0 }, // 0 = غير محدود
        commissionRate: { type: Number, default: 5 }, // نسبة العمولة
        storageLimitGB: { type: Number, default: 5 },
        prioritySupport: { type: Boolean, default: false },
        featuredListing: { type: Boolean, default: false },
        analytics: { type: Boolean, default: false },
        customDomain: { type: Boolean, default: false },
        status: { 
          type: String, 
          required: true, 
          enum: ['active', 'inactive', 'coming_soon'], 
          default: 'active' 
        }
      }],

      subscriptionPoints: {
        monthlyBonus: { type: Number, required: true, default: 100 },
        referralBonus: { type: Number, required: true, default: 200 },
        enabled: { type: Boolean, required: true, default: true },
      },

      paymentSettings: {
        stripeEnabled: { type: Boolean, required: true, default: false },
        stripePublishableKey: { type: String },
        stripeSecretKey: { type: String },
        paypalEnabled: { type: Boolean, required: true, default: false },
        paypalClientId: { type: String },
        minimumSubscriptionAmount: { type: Number, required: true, default: 1 },
      },

      // إعدادات الإشعارات
      notifications: {
        trialEndingReminderDays: { type: [Number], default: [3, 1] },
        renewalReminderDays: { type: [Number], default: [7, 3, 1] },
        emailNotifications: { type: Boolean, required: true, default: true },
        smsNotifications: { type: Boolean, required: true, default: false },
      }
    },

    carousels: [
      {
        title: { type: String, required: true },
        url: { type: String, required: true, unique: true },
        image: { type: String, required: true },
        buttonCaption: { type: String, required: true },
      },
    ],
    availableLanguages: [
      {
        name: { type: String, required: true },
        code: { type: String, required: true },
      },
    ],
    defaultLanguage: { type: String, required: true },
    availableCurrencies: [
      {
        name: { type: String, required: true },
        code: { type: String, required: true },
        convertRate: { type: Number, required: true },
        symbol: { type: String, required: true },
      },
    ],
    defaultCurrency: { type: String, required: true },
    availablePaymentMethods: [
      {
        name: { type: String, required: true },
        commission: { type: Number, required: true, default: 0 },
      },
    ],
    defaultPaymentMethod: { type: String, required: true },
    availableDeliveryDates: [
      {
        name: { type: String, required: true },
        daysToDeliver: { type: Number, required: true },
        shippingPrice: { type: Number, required: true },
        freeShippingMinPrice: { type: Number, required: true },
      },
    ],
    defaultDeliveryDate: { type: String, required: true },
    featuredSellerId: { type: String },
  aiAssistant: {
    price: { type: Number, required: true, default: 7.00 },
    description: { 
      type: String, 
      required: true, 
      default: 'Unlock the full potential of the AI Assistant with a Premium subscription!' 
    },
    image: { 
      type: String, 
      required: true, 
      default: 'https://mgzonai.vercel.app/static/images/mg.svg' 
    },
    enabled: { type: Boolean, required: true, default: true },
    freeLimit: { type: Number, required: true, default: 10 },
    stripeProductId: { type: String },
    stripePriceId: { type: String },
  }
  },
  {
    timestamps: true,
  }
);

// إضافة فهرس للبحث السريع في خطط الاشتراكات
settingSchema.index({ 'subscriptions.plans.slug': 1 });

const Setting = (models.Setting as Model<ISetting>) || model<ISetting>('Setting', settingSchema);

export default Setting;