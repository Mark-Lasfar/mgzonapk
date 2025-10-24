// /lib/db/models/store.model.ts
import mongoose, { Schema, model, models, Document } from 'mongoose';
import validator from 'validator';

interface IStore extends Document {
  storeId: string;
  sellerId: mongoose.Types.ObjectId;
  name: string;
  domain?: string;
  domains?: Array<{ domainName: string; isPrimary: boolean; dnsStatus: 'pending' | 'verified' | 'failed' }>;
  platform: string;
  credentials?: {
    accessToken?: string;
    refreshToken?: string;
    clientId?: string;
    clientSecret?: string;
    awsAccessKey?: string;
    awsSecretKey?: string;
    roleArn?: string;
    shopDomain?: string;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  templateId?: mongoose.Types.ObjectId;
  customSite?: {
    theme: string;
    primaryColor: string;
    logo?: string;
    bannerImage?: string;
    customSections: Array<{
      title: string;
      slug: string;
      content: string;
      type: 'custom' | 'hero' | 'products' | 'testimonials' | 'faq';
      position: number;
      customCSS?: string;
      customHTML?: string;
    }>;
    seo?: {
      metaTitle?: string;
      metaDescription?: string;
      keywords?: string[];
    };
    domainStatus?: 'pending' | 'active' | 'failed';
    customDomain?: string;
    developerMode?: boolean; // New field for enabling developer mode
    customAssets?: Array<{ name: string; url: string }>; // New for custom assets
  };
}

const storeSchema = new Schema<IStore>(
  {
    storeId: { type: String, required: true, unique: true, trim: true },
    sellerId: { type: Schema.Types.ObjectId, ref: 'Seller', required: true, index: true },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    domain: { type: String, trim: true, validate: { validator: (v: string) => !v || validator.isURL(v, { protocols: ['http', 'https'], require_protocol: true }), message: 'Please provide a valid URL' } },
    domains: [
      {
        domainName: { type: String, required: true, validate: { validator: validator.isURL, message: 'Invalid URL format' } },
        isPrimary: { type: Boolean, default: false },
        dnsStatus: { type: String, enum: ['pending', 'verified', 'failed'], default: 'pending' },
      },
    ],
    platform: { type: String, enum: ['shopify', 'aliexpress', 'amazon', 'custom'], required: true },
    credentials: {
      accessToken: { type: String, trim: true },
      refreshToken: { type: String, trim: true },
      clientId: { type: String, trim: true },
      clientSecret: { type: String, trim: true },
      awsAccessKey: { type: String, trim: true },
      awsSecretKey: { type: String, trim: true },
      roleArn: { type: String, trim: true },
      shopDomain: { type: String, trim: true },
    },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    templateId: { type: Schema.Types.ObjectId, ref: 'Template' },
    customSite: {
      theme: { type: String, default: 'default' },
      primaryColor: { type: String, default: '#ff6600', match: [/^#[0-9A-F]{6}$/i, 'Please provide a valid hex color'] },
      logo: { type: String },
      bannerImage: { type: String },
      customSections: [
        {
          title: { type: String, required: true },
          slug: { type: String, required: true },
          content: { type: String, required: true },
          type: { type: String, enum: ['text', 'image', 'video', 'button', 'heading', 'divider', 'spacer',
                  'carousel', 'slider', 'gallery', 'columns', 'pricing-table', 'cta', 'accordion', 'tabs',
                  'testimonials', 'testimonial-carousel', 'logos', 'timeline', 'steps', 'animation', 'count-up',
                  'popup', 'newsletter', 'contact-form', 'map', 'products', 'product-card', 'collection-banner',
                  'upsell', 'related-products', 'quick-view', 'carousel-products', 'reviews', 'hero', 'footer',
                  'faq', 'navigation', 'blog-posts', 'article', 'breadcrumbs', 'sidebar', 'background-video',
                  'icon-grid', 'image-grid', 'shape-divider','chat'], default: 'custom' },
          position: { type: Number, required: true },
          customCSS: { type: String, default: '' },
          customHTML: { type: String, default: '' },
        },
      ],
      seo: {
        metaTitle: { type: String, maxlength: 60 },
        metaDescription: { type: String, maxlength: 160 },
        keywords: [{ type: String }],
      },
      domainStatus: { type: String, enum: ['pending', 'active', 'failed'], default: 'pending' },
      customDomain: { type: String, validate: { validator: validator.isURL, message: 'Invalid URL format' } },
      developerMode: { type: Boolean, default: false }, // New
      customAssets: [{ name: { type: String }, url: { type: String } }], // New
    },
  },
  { timestamps: true }
);

storeSchema.index({ storeId: 1, name: 1 }, { unique: true });
storeSchema.index({ sellerId: 1, isActive: 1, platform: 1 });

const Store = models.Store || model<IStore>('Store', storeSchema);
export default Store;