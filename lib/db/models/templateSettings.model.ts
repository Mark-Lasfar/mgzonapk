import mongoose, { Schema, Document } from 'mongoose';

interface Testimonial {
  id: string;
  name: string;
  quote: string;
  rating: number;
  image?: string;
}

interface ShippingOption {
  name: string;
  provider: string;
  cost: number;
  estimatedDeliveryDays: number;
  regions: string[];
  isActive: boolean;
}

interface DiscountOffer {
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  startDate: Date;
  endDate?: Date;
  minOrderValue: number;
  isActive: boolean;
}

interface PaymentGateway {
  providerName: string;
  isActive: boolean;
  isDefault: boolean;
}

interface TemplateSettings extends Document {
  components: string[];
  themes: string[];
  fonts: string[];
  colors: string[];
  backgrounds: string[];
  testimonials: Testimonial[];
  shippingOptions: ShippingOption[];
  discountOffers: DiscountOffer[];
  paymentGateways: PaymentGateway[];
  layout: {
    header: string;
    footer: string;
    main: string[];
    sidebar?: string[];
  };
  analytics: {
    provider: string;
    trackingId?: string;
  };
  multiLanguage: {
    defaultLocale: string;
    supportedLocales: string[];
  };
  customCSS?: string;
  customJS?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TestimonialSchema = new Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  quote: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  image: { type: String },
});

const ShippingOptionSchema = new Schema({
  name: { type: String, required: true },
  provider: { type: String, required: true },
  cost: { type: Number, required: true, min: 0 },
  estimatedDeliveryDays: { type: Number, required: true, min: 1 },
  regions: { type: [String], required: true },
  isActive: { type: Boolean, required: true, default: true },
});

const DiscountOfferSchema = new Schema({
  code: { type: String, required: true, unique: true },
  discountType: { type: String, enum: ['percentage', 'fixed'], required: true },
  discountValue: { type: Number, required: true, min: 0 },
  startDate: { type: Date, required: true },
  endDate: { type: Date },
  minOrderValue: { type: Number, required: true, min: 0 },
  isActive: { type: Boolean, required: true, default: true },
});

const PaymentGatewaySchema = new Schema({
  providerName: { type: String, required: true },
  isActive: { type: Boolean, required: true, default: true },
  isDefault: { type: Boolean, required: true, default: false },
});

const TemplateSettingsSchema = new Schema({
  components: { type: [String], required: true, default: ['HeroModern', 'ProductGrid', 'FooterMinimal', 'TestimonialsSlider', 'BannerSection', 'FeaturedProducts', 'CategoryList'] },
  themes: { type: [String], required: true, default: ['light', 'dark', 'default'] },
  fonts: { type: [String], required: true, default: ['Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins', 'Inter', 'Tajawal'] },
  colors: { type: [String], required: true, default: ['#ff6600', '#00cc99', '#3366ff', '#cc33ff', '#ff3366', '#6633cc'] },
  backgrounds: { type: [String], required: true, default: ['/hero-bg-1.jpg', '/hero-bg-2.jpg', '/hero-bg-3.jpg', '/custom-bg.jpg'] },
  testimonials: { type: [TestimonialSchema], required: true, default: [
    { id: '1', name: 'John Doe', quote: 'Amazing products!', rating: 5, image: '/user1.jpg' },
    { id: '2', name: 'Jane Smith', quote: 'Great service!', rating: 4, image: '/user2.jpg' },
    { id: '3', name: 'Ahmed Ali', quote: 'Fast delivery!', rating: 5, image: '/user3.jpg' },
  ] },
  shippingOptions: { type: [ShippingOptionSchema], default: [] },
  discountOffers: { type: [DiscountOfferSchema], default: [] },
  paymentGateways: { type: [PaymentGatewaySchema], default: [] },
  layout: {
    header: { type: String, required: true, default: 'HeaderStandard' },
    footer: { type: String, required: true, default: 'FooterMinimal' },
    main: { type: [String], required: true, default: ['HeroModern', 'ProductGrid'] },
    sidebar: { type: [String], default: [] },
  },
  analytics: {
    provider: { type: String, required: true, default: 'google' },
    trackingId: { type: String },
  },
  multiLanguage: {
    defaultLocale: { type: String, required: true, default: 'en' },
    supportedLocales: { type: [String], required: true, default: ['en', 'ar', 'es', 'fr'] },
  },
  customCSS: { type: String },
  customJS: { type: String },
  isActive: { type: Boolean, required: true, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// إضافة فهرس لتحسين الأداء
TemplateSettingsSchema.index({ isActive: 1 });

TemplateSettingsSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.models.TemplateSettings || mongoose.model<TemplateSettings>('TemplateSettings', TemplateSettingsSchema);