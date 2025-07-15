// /home/hager/Trash/my-nextjs-project-master/lib/types/settings.ts

import { z } from 'zod';
import { SellerFormData } from './index';
import { t } from 'i18next';

// تعريف مخطط Zod للتحقق من صحة البيانات
export const ShippingOptionSchema = z.object({
  id: z.string().optional(), // معرف الخيار (اختياري عند الإنشاء)
  name: z.string().min(1, 'Shipping option name is required'), // اسم خيار الشحن
  daysToDeliver: z.number().min(0, 'Days to deliver must be non-negative'), // عدد الأيام للتسليم
  shippingPrice: z.number().min(0, 'Shipping price must be non-negative'), // سعر الشحن
  freeShippingMinPrice: z.number().min(0, 'Free shipping minimum price must be non-negative'), // الحد الأدنى للشحن المجاني
  supportedCountries: z.array(z.string().regex(/^[A-Z]{2}$/, 'Invalid country code')).optional(), // الدول المدعومة
  isActive: z.boolean().default(true), // حالة التفعيل
  provider: z.string().min(1, t('warehouse_provider_required')).optional(),

});

export const DiscountOfferSchema = z.object({
  id: z.string().optional(), // معرف العرض (اختياري عند الإنشاء)
  code: z.string().min(1, 'Discount code is required'), // رمز الخصم
  description: z.string().optional(), // وصف العرض
  discountType: z.enum(['percentage', 'fixed', 'free_shipping']), // نوع الخصم
  discountValue: z.number().min(0, 'Discount value must be non-negative'), // قيمة الخصم
  minPurchase: z.number().min(0, 'Minimum purchase amount must be non-negative').optional(), // الحد الأدنى للشراء
  maxDiscount: z.number().min(0, 'Maximum discount amount must be non-negative').optional(), // الحد الأقصى للخصم
  validFrom: z.date().optional(), // تاريخ بدء الصلاحية
  validUntil: z.date().optional(), // تاريخ انتهاء الصلاحية
  maxUses: z.number().min(0, 'Maximum uses must be non-negative').optional(), // الحد الأقصى للاستخدامات
  usedCount: z.number().min(0, 'Used count must be non-negative').default(0), // عدد الاستخدامات الحالية
  isActive: z.boolean().default(true), // حالة التفعيل
  applicableProducts: z.array(z.string()).optional(), // المنتجات المطبق عليها العرض
  applicableCategories: z.array(z.string()).optional(), // الفئات المطبق عليها العرض
});

// تحديث SettingsFormData لتكون متوافقة مع النظام الديناميكي
export const SettingsFormDataSchema = z.object({
  // معلومات الأعمال (موروثة من SellerFormData)
  businessName: z.string().min(1, 'Business name is required').optional(),
  description: z.string().optional(),
  email: z.string().email('Invalid email format'),
  phone: z.string().optional(),
  customSiteUrl: z.string().optional(),

  // معلومات العنوان
  address: z
    .object({
      street: z.string().min(1, 'Street is required'),
      city: z.string().min(1, 'City is required'),
      state: z.string().optional(),
      // country: z.string().min(1, 'Country is required'),
      postalCode: z.string().min(1, 'Postal code is required'),
      countryCode: z.string().regex(/^[A-Z]{2}$/, 'Invalid country code'),
    })
    .optional(),

  // معلومات البنك
  bankInfo: z
    .object({
      accountName: z.string().min(1, 'Account name is required'),
      accountNumber: z.string().min(1, 'Account number is required'),
      bankName: z.string().min(1, 'Bank name is required'),
      swiftCode: z.string().min(1, 'Swift code is required'),
      verified: z.boolean().default(false),
    })
    .optional(),

  // إعدادات الإشعارات
  notifications: z.object({
    email: z.boolean(),
    sms: z.boolean(),
    orderUpdates: z.boolean(),
    marketingEmails: z.boolean(),
    pointsNotifications: z.boolean(),
  }),

  // إعدادات العرض
  display: z.object({
    showRating: z.boolean(),
    showContactInfo: z.boolean(),
    showMetrics: z.boolean(),
    showPointsBalance: z.boolean(),
  }),

  // إعدادات الأمان
  security: z.object({
    twoFactorAuth: z.boolean(),
    loginNotifications: z.boolean(),
  }),

  // إعدادات الموقع المخصص
  customSite: z.object({
    theme: z.string().default('default'),
    primaryColor: z.string().regex(/^#([0-9A-F]{3}){1,2}$/i, 'Invalid color format'),
    bannerImage: z.string().url('Invalid URL format').optional(),
    customSections: z.array(z.string()).optional(),
  }),

  // إضافة خيارات الشحن
  shippingOptions: z.array(ShippingOptionSchema).optional(),

  // إضافة عروض الخصم
  discountOffers: z.array(DiscountOfferSchema).optional(),

  // بوابات الدفع
  paymentGateways: z
    .array(
      z.object({
        providerName: z.string().min(1, 'Provider name is required'),
        accountDetails: z.record(z.string()).optional(),
        verified: z.boolean().default(false),
        isDefault: z.boolean().default(false),
        isInternal: z.boolean().default(false),
      })
    )
    .optional(),
});

// أنواع TypeScript المشتقة من مخططات Zod
export type ShippingOption = z.infer<typeof ShippingOptionSchema>;
export type DiscountOffer = z.infer<typeof DiscountOfferSchema>;
export type SettingsFormData = z.infer<typeof SettingsFormDataSchema>;

// واجهة للتعامل مع إعدادات النظام الديناميكي
export interface DynamicSettings extends SettingsFormData {
  integrations?: Array<{
    providerName: string;
    type: string;
    credentials: Record<string, string>;
    isActive: boolean;
    sandbox: boolean;
  }>;
  customFields?: Record<string, any>; // لدعم الحقول المخصصة الديناميكية
}