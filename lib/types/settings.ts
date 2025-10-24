// /lib/types/settings.ts
import { z } from 'zod';
import { t } from 'i18next';


export const SectionContentSchema = z.union([
  z.object({
    text: z.string().optional(),
    url: z.string().optional(),
    label: z.string().optional(),
    title: z.string().optional(),
    subtitle: z.string().optional(),
    children: z.array(z.any()).optional(),
    slug: z.string().optional(),
    endDate: z.string().optional(), // ISO string for countdown
    reviews: z.array(z.object({ name: z.string(), quote: z.string(), image: z.string() })).optional(), // لـ testimonials و testimonial-carousel
    images: z.array(z.string()).optional(), // لـ carousel, slider, gallery, image-grid
    productIds: z.array(z.string()).optional(), // لدعم الحالات القديمة إذا لزم الأمر
    faqs: z.array(z.object({ question: z.string(), answer: z.string() })).optional(), // لـ faq (كـ items)
    testimonials: z.array(z.object({ name: z.string(), quote: z.string(), image: z.string() })).optional(), // لـ testimonials و testimonial-carousel
    backgroundImage: z.string().optional(), // لـ hero
    backgroundColor: z.string().optional(), // لـ footer
    endpoint: z.string().optional(), // لـ contact-form
    description: z.string().optional(),
    productImage: z.string().optional(), // لـ Upsell, ProductCard
    productName: z.string().optional(), // لـ Upsell, ProductCard
    productPrice: z.string().optional(), // لـ Upsell, ProductCard
    buttonText: z.string().optional(),
    items: z.array(z.any()).optional(), // لـ accordion, timeline
    settings: z.record(z.string(), z.any()).optional(),
    // لمكونات معينة
    tabs: z.array(z.object({ label: z.string(), content: z.string() })).optional(), // لـ Tabs
    steps: z.array(z.object({ title: z.string(), description: z.string() })).optional(), // لـ Steps
    logos: z.array(z.object({ src: z.string(), alt: z.string() })).optional(), // لـ Logos
    products: z.array(z.object({ image: z.string(), title: z.string(), price: z.string() })).optional(), // لـ Products, RelatedProducts, CarouselProducts
    image: z.string().optional(), // لـ CollectionBanner
    placeholder: z.string().optional(), // لـ Newsletter
    buttonLink: z.string().optional(), // لـ CollectionBanner
    columns: z.number().optional(), // لـ Columns
    gap: z.string().optional(), // لـ Columns
    chatScript: z.string().optional(), // إضافة حقل chatScript
    // customJS:z.string().optional(),   // إضافة حقل customJS لدعم JavaScript
  }),
]);

export type SectionType =
  | 'text' | 'image' | 'video' | 'button' | 'heading' | 'divider' | 'spacer' |'countdown'
  | 'carousel' | 'slider' | 'gallery' | 'columns' | 'features-grid' | 'pricing-table' | 'cta' | 'accordion' | 'tabs' | 'testimonials' | 'testimonial-carousel' | 'logos' | 'timeline' | 'steps' | 'animation' | 'count-up'
  | 'popup' | 'newsletter' | 'contact-form' | 'map'
  | 'products' | 'product-card' | 'collection-banner' | 'upsell' | 'related-products' | 'quick-view' | 'carousel-products' | 'reviews'
  | 'hero' | 'footer' | 'faq' | 'breadcrumbs' | 'navigation' |'custom'| 'sidebar' | 'blog-posts' | 'article' | 'background-video' | 'icon-grid' | 'image-grid' | 'shape-divider' |'chat';



// Define SectionSchema for Template
export const SectionSchema = z.object({
  id: z.string(),
  type: z.enum([
    'text', 'image', 'video', 'button', 'heading', 'divider', 'spacer', 'countdown',
    'carousel', 'slider', 'gallery', 'columns', 'features-grid','custom', 'pricing-table', 'cta', 'accordion', 'tabs', 'testimonials', 'testimonial-carousel', 'logos', 'timeline', 'steps', 'animation', 'count-up',
    'popup', 'newsletter', 'contact-form', 'map',
    'products', 'product-card', 'collection-banner', 'upsell', 'related-products', 'quick-view', 'carousel-products', 'reviews',
    'hero', 'footer', 'faq', 'breadcrumbs', 'navigation', 'sidebar', 'blog-posts', 'article', 'background-video', 'icon-grid', 'image-grid', 'shape-divider', 'chat',
  ]),

  content: SectionContentSchema,
  position: z.number(),
  customCSS: z.string().optional(),
  customHTML: z.string().optional(),
  customJS: z.string().optional(),
});

// Define TemplateFormDataSchema
export const TemplateFormDataSchema = z.object({
  layout: z.array(z.string()).optional(),
  colors: z.object({
    primary: z.string().regex(/^#([0-9A-F]{3}){1,2}$/i, { message: t('Invalid color format') }),
    secondary: z.string().regex(/^#([0-9A-F]{3}){1,2}$/i, { message: t('Invalid color format') }),
  }),
  heroConfig: z.object({
    title: z.string().optional(),
    subtitle: z.string().optional(),
  }),
  assets: z
    .array(
      z.object({
        name: z.string(),
        url: z.string().url({ message: t('Invalid URL format') }),
      })
    )
    .optional(),
});

// Define TemplateSchema
export const TemplateSchema = TemplateFormDataSchema.extend({
  templateId: z.string().optional(),
  name: z.string().optional(),
  isPublic: z.boolean().optional(),
  sections: z.array(SectionSchema).optional(),
});

// Define ShippingOptionSchema
export const ShippingOptionSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, { message: t('Shipping option name is required') }),
  daysToDeliver: z.number().min(0, { message: t('Days to deliver must be non-negative') }),
  shippingPrice: z.number().min(0, { message: t('Shipping price must be non-negative') }),
  freeShippingMinPrice: z.number().min(0, { message: t('Free shipping minimum price must be non-negative') }),
  supportedCountries: z.array(z.string().regex(/^[A-Z]{2}$/, { message: t('Invalid country code') })).optional(),
  isActive: z.boolean().default(true),
  provider: z.string().min(1, { message: t('warehouse_provider_required') }).optional(),
});

// Define DiscountOfferSchema
export const DiscountOfferSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(1, { message: t('Discount code is required') }),
  description: z.string().optional(),
  discountType: z.enum(['percentage', 'fixed', 'free_shipping'], { message: t('Invalid discount type') }),
  discountValue: z.number().min(0, { message: t('Discount value must be non-negative') }),
  minPurchase: z.number().min(0, { message: t('Minimum purchase amount must be non-negative') }).optional(),
  maxDiscount: z.number().min(0, { message: t('Maximum discount amount must be non-negative') }).optional(),
  validFrom: z.coerce.date().optional(),
  validUntil: z.coerce.date().optional(),
  maxUses: z.number().min(0, { message: t('Maximum uses must be non-negative') }).optional(),
  usedCount: z.number().min(0, { message: t('Used count must be non-negative') }).default(0),
  isActive: z.boolean().default(true),
  applicableProducts: z.array(z.string()).optional(),
  applicableCategories: z.array(z.string()).optional(),
});

// Define SettingsFormDataSchema
export const SettingsFormDataSchema = z.object({
  businessName: z.string().min(1, { message: t('Business name is required') }).optional(),
  description: z.string().optional(),
  email: z.string().email({ message: t('Invalid email format') }),
  phone: z.string().optional(),
  customSiteUrl: z.string().url({ message: t('Invalid URL format') }).optional(),
  address: z
    .object({
      street: z.string().min(1, { message: t('Street is required') }),
      city: z.string().min(1, { message: t('City is required') }),
      state: z.string().optional(),
      postalCode: z.string().min(1, { message: t('Postal code is required') }),
      countryCode: z.string().regex(/^[A-Z]{2}$/, { message: t('Invalid country code') }),
    })
    .optional(),
  subscription: z
    .object({
      plan: z.enum(['Trial', 'Basic', 'Pro', 'VIP'], { message: t('Invalid subscription plan') }),
      status: z.enum(['active', 'inactive', 'pending']).optional(),
    })
    .optional(),
  bankInfo: z
    .object({
      accountName: z.string().min(1, { message: t('Account name is required') }),
      accountNumber: z.string().min(1, { message: t('Account number is required') }),
      bankName: z.string().min(1, { message: t('Bank name is required') }),
      swiftCode: z.string().min(1, { message: t('Swift code is required') }),
      verified: z.boolean().default(false),
    })
    .optional(),
  notifications: z.object({
    email: z.boolean(),
    sms: z.boolean(),
    push: z.boolean(),
    orderUpdates: z.boolean(),
    marketingEmails: z.boolean(),
    pointsNotifications: z.boolean(),
  }),
  integrations: z
    .array(
      z.object({
        providerName: z.string().min(1, { message: t('Provider name is required') }),
        type: z.enum([
          'payment',
          'warehouse',
          'dropshipping',
          'marketplace',
          'shipping',
          'marketing',
          'accounting',
          'crm',
          'analytics',
          'automation',
          'communication',
          'education',
          'security',
          'advertising',
          'tax',
          'other',
        ], { message: t('Invalid integration type') }),
        credentials: z.record(z.string(), z.string()).optional(),
        isActive: z.boolean().default(true),
        sandbox: z.boolean().default(false),
      })
    )
    .optional(),
  taxSettings: z
    .record(
      z.string(),
      z.object({
        countryCode: z.string().regex(/^[A-Z]{2}$/, { message: t('Invalid country code') }),
        taxType: z.enum(['vat', 'sales_tax', 'none']).default('none'),
        taxRate: z.number().min(0).max(100, { message: t('Tax rate must be between 0 and 100') }),
        taxService: z.enum(['avalara', 'taxjar', 'none']).default('none'),
      })
    )
    .optional(),
  display: z.object({
    showRating: z.boolean(),
    showContactInfo: z.boolean(),
    showMetrics: z.boolean(),
    showPointsBalance: z.boolean(),
    welcomeSeen: z.boolean(),
  }),
  security: z.object({
    twoFactorAuth: z.boolean(),
    loginNotifications: z.boolean(),
  }),
  customSite: z
    .object({
      theme: z.string().default('default'),
      primaryColor: z.string().regex(/^#([0-9A-F]{3}){1,2}$/i, { message: t('Invalid color format') }),
      logo: z.any().optional(),
      bannerImage: z.any().optional(),
      customSections: z
        .array(
          z.object({
            title: z.string().min(2, { message: t('Section title must be at least 2 characters') }),
            slug: z.string().min(1, { message: t('Section slug is required') }),
            content: z.string().min(10, { message: t('Section content must be at least 10 characters') }),
            
            type: z.enum([
              'custom', 'hero', 'products', 'testimonials', 'faq', 'footer', 'contact-form', 'countdown',
              'text', 'image', 'video', 'button', 'heading', 'divider', 'spacer',
              'carousel', 'slider', 'gallery', 'columns', 'features-grid', 'pricing-table', 'cta', 'accordion', 'tabs', 'testimonial-carousel', 'logos', 'timeline', 'steps', 'animation', 'count-up',
              'popup', 'newsletter', 'map',
              'product-card', 'collection-banner', 'upsell', 'related-products', 'quick-view', 'carousel-products', 'reviews',
              'breadcrumbs', 'navigation', 'sidebar', 'blog-posts', 'article', 'background-video', 'icon-grid', 'image-grid', 'shape-divider','chat',
            ], { message: t('Invalid section type') }),
            
            position: z.number().optional(),
            customCSS: z.string().optional(),
            customHTML: z.string().optional(),
            customJS: z.string().optional(),

          })
        )
        .optional(),
      seo: z
        .object({
          metaTitle: z.string().max(60, { message: t('Meta title must be 60 characters or less') }).optional(),
          metaDescription: z.string().max(160, { message: t('Meta description must be 160 characters or less') }).optional(),
          keywords: z.array(z.string()).optional(),
        })
        .optional(),
      domainStatus: z.enum(['pending', 'active', 'expired']).optional(),
      customDomain: z.string().url({ message: t('Invalid URL format') }).optional(),
    })
    .optional(),
  template: TemplateFormDataSchema.optional(),
  shippingOptions: z.array(ShippingOptionSchema).optional(),
  discountOffers: z.array(DiscountOfferSchema).optional(),
  paymentGateways: z
    .array(
      z.object({
        providerName: z.string().min(1, { message: t('Provider name is required') }),
        commission: z.number().min(0).max(100, { message: t('Commission must be between 0 and 100') }).optional(),
        isActive: z.boolean().default(true),
        verified: z.boolean().default(false),
        isDefault: z.boolean().default(false),
        isInternal: z.boolean().default(false),
        sandbox: z.boolean().default(false),
      })
    )
    .optional(),
  domains: z
    .array(
      z.object({
        domainName: z.string().url({ message: t('Invalid URL format') }),
        isPrimary: z.boolean(),
        dnsStatus: z.enum(['pending', 'verified', 'failed']),
      })
    )
    .optional(),
  verification: z
    .object({
      documents: z
        .array(
          z.object({
            url: z.any().optional(),
            type: z.enum(['id', 'business_license', 'tax_document', 'other']),
            status: z.enum(['pending', 'verified', 'rejected']).default('pending'),
            uploadedAt: z.coerce.date().optional(),
            metadata: z.record(z.string(), z.any()).optional(),
          })
        )
        .optional(),
      status: z.enum(['pending', 'verified', 'rejected']).optional(),
      submittedAt: z.coerce.date().optional(),
      lastUpdatedAt: z.coerce.date().optional(),
    })
    .optional(),
  defaultPaymentGateway: z.string().optional(),
});

// Define types
export type Section = z.infer<typeof SectionSchema>;
export type Template = z.infer<typeof TemplateSchema>;
export type ShippingOption = z.infer<typeof ShippingOptionSchema>;
export type DiscountOffer = z.infer<typeof DiscountOfferSchema>;
export type SettingsFormData = z.infer<typeof SettingsFormDataSchema>;
export type TemplateFormData = z.infer<typeof TemplateFormDataSchema>;

export interface DynamicSettings extends SettingsFormData {
  integrations?: Array<{
    providerName: string;
    type:
      | 'payment'
      | 'warehouse'
      | 'dropshipping'
      | 'marketplace'
      | 'shipping'
      | 'marketing'
      | 'accounting'
      | 'crm'
      | 'analytics'
      | 'automation'
      | 'communication'
      | 'education'
      | 'security'
      | 'advertising'
      | 'tax'
      | 'other';
    credentials: Record<string, string>;
    isActive: boolean;
    sandbox: boolean;
  }>;
  customFields?: Record<string, any>;
}