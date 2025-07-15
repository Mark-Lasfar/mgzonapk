import { Notification, IProductInput as ApiProductInput } from '@/lib/api/types';
import { UseFormReturn } from 'react-hook-form';

export interface IUserInput {
  email: string;
  name: string;
  role: 'user' | 'Admin' | 'SELLER';
  image?: string;
}

interface PointsFormProps {
  id: string;
  form: UseFormReturn<ISettingInput>;
  points: Record<string, any>;
}

export interface ISettingInput {
  availablePaymentMethods: PaymentMethodField[];
  defaultPaymentMethod: string;
    // existing properties
    points: Record<string, any>;
  
}

export interface PaymentMethodField {
  name: string;
  commission: number;
}
// IOrderInput
export interface IOrderInput {
  userId: string;
  items: {
    productId: string;
    quantity: number;
    price: number;
  }[];
  shippingAddress: {
    name: string;
    street: string;
    city: string;
    state: string;
    countryCode: string;
    postalCode: string;
    phone?: string;
  };
  paymentMethod: string;
  totalPrice: number;
}

// IUserSignIn
export interface IUserSignIn {
  email: string;
  password: string;
}

// lib/types.ts
export interface SellerFormData {
  businessName: string;
  email: string;
  phone: string;
  description?: string;
  businessType: 'individual' | 'company';
  vatRegistered?: boolean;
  logo?: File;
  address: {
    street: string;
    city: string;
    state: string;
    countryCode: string;
    postalCode: string;
  };
  taxId?: string;
  // bankInfo?: {
  //   accountName: string;
  //   accountNumber: string;
  //   bankName: string;
  //   swiftCode: string;
  // };
  termsAccepted: boolean;
  customSiteUrl?: string;
  is_trial?: boolean;
}

export interface SettingsFormData {
  // Business Information
  businessName?: string; // اسم الشركة أو النشاط التجاري
  description?: string; // وصف النشاط التجاري
  email: string; // البريد الإلكتروني للتواصل
  phone?: string; // رقم الهاتف
  address?: {
    street: string; // اسم الشارع
    city: string; // المدينة
    state?: string; // الولاية أو المحافظة (إن وجدت)
    // country: string; // الدولة
    postalCode: string; // الرمز البريدي
    countryCode: string;
  };

  // Banking Information
  bankInfo?: {
    accountName: string; // اسم صاحب الحساب
    accountNumber: string; // رقم الحساب البنكي
    bankName: string; // اسم البنك
    swiftCode: string; // رمز SWIFT للتحويلات الدولية
  };

  // Notification Preferences
  notifications: {
    email: boolean; // تفعيل إشعارات البريد الإلكتروني
    sms: boolean; // تفعيل إشعارات الرسائل النصية
    orderUpdates: boolean; // إشعارات تحديثات الطلبات
    marketingEmails: boolean; // إشعارات البريد التسويقي
    pointsNotifications: boolean; // إشعارات رصيد النقاط
  };

  // Display Settings
  display: {
    showRating: boolean; // عرض تقييمات العملاء
    showContactInfo: boolean; // عرض معلومات التواصل
    showMetrics: boolean; // عرض المقاييس والإحصائيات
    showPointsBalance: boolean; // عرض رصيد النقاط
    [key: string]: any; // السماح بحقول ديناميكية إضافية
  };

  // Security Settings
  security: {
    twoFactorAuth: boolean; // تفعيل المصادقة الثنائية
    loginNotifications: boolean; // إشعارات تسجيل الدخول
    [key: string]: any; // السماح بحقول ديناميكية إضافية
  };

  // Custom Website Settings
  customSite: {
    theme: string; // سمة التصميم (مثل: dark, light)
    primaryColor: string; // اللون الأساسي للموقع
    bannerImage?: string; // رابط صورة البانر (اختياري)
    customSections?: string[]; // أقسام مخصصة للموقع
  };
  customSiteUrl?: string; // رابط الموقع المخصص (اختياري)
}

export interface IProductInput extends ApiProductInput {}

export type { Notification };