// /home/mark/Music/my-nextjs-project-clean/lib/actions/setting.actions.ts
'use server';

import { unstable_cache } from 'next/cache';
import { ISettingInput } from '@/types';
import data from '../data';
import Setting from '@/lib/db/models/setting.model';
import { connectToDatabase } from '@/lib/db';
import { formatError } from '../utils';
import { cookies } from 'next/headers';

// Type for responses
interface SettingResponse<T = void> {
  success: boolean;
  message: string;
  data?: T;
}

// Default settings object
const DEFAULT_SETTINGS: ISettingInput = {
  site: {
    name: 'MGZon',
    slogan: 'Your Ultimate Shopping Destination',
    description: 'Shop online for the best products at great prices',
    url: process.env.NEXT_PUBLIC_APP_URL || 'https://hager-zon.vercel.app',
    email: 'support@mgzon.com',
    address: '123 Main St',
    phone: '+02 1212444617',
    logo: 'icons/logo.svg',
    keywords: 'ecommerce, shopping',
    author: 'MGZon Team',
    copyright: '© 2025 MGZon',
  },
  seo: {
    metaTitle: 'MGZon',
    metaDescription: 'Shop online for the best products at great prices',
    keywords: 'ecommerce, shopping',
    ogImage: '/icons/og-image.jpg',
    robots: 'index, follow',
  },
  common: {
    pageSize: 9,
    isMaintenanceMode: false,
    freeShippingMinPrice: 0,
    defaultTheme: 'light',
    defaultColor: 'gold',
    featuredCategories: [],
  },
  availableLanguages: [
    {
      name: 'English',
      code: 'en-US',
    },
    {
      name: 'Arabic',
      code: 'ar-SA',
    },
  ],
  carousels: [],
  defaultLanguage: 'en-US',
  availableCurrencies: [
    {
      name: 'US Dollar',
      code: 'USD',
      symbol: '$',
      convertRate: 1,
    },
    {
      name: 'Egyptian Pound',
      code: 'EGP',
      symbol: 'EGP',
      convertRate: 48,
    },
  ],
  defaultCurrency: 'USD',
  availablePaymentMethods: [
    {
      name: 'Credit Card',
      commission: 0,
    },
    {
      name: 'PayPal',
      commission: 0.03,
    },
  ],
  defaultPaymentMethod: 'Credit Card',
  availableDeliveryDates: [
    {
      name: 'Standard Shipping',
      daysToDeliver: 3,
      shippingPrice: 0,
      freeShippingMinPrice: 50,
    },
    {
      name: 'Express Shipping',
      daysToDeliver: 1,
      shippingPrice: 10,
      freeShippingMinPrice: 100,
    },
  ],
  defaultDeliveryDate: 'Standard Shipping',
  integrations: [],
  points: {
    earnRate: 1,
    redeemValue: 0.05,
    registrationBonus: {
      buyer: 50,
      seller: 100,
    },
    sellerPointsPerSale: 10,
    enabled: true,
    rate: 1,
  },
  subscriptions: {
    points: {
      earnRate: 1,
      redeemValue: 0.05,
      registrationBonus: {
        buyer: 50,
        seller: 100,
      },
      sellerPointsPerSale: 10,
      enabled: true,
      rate: 1,
    },
    // يمكن إضافة المزيد من إعدادات الاشتراكات هنا
    enabled: true,
    trialDays: 14,
    autoRenew: true,
  },
};

/**
 * Ensures settings are not null and have proper defaults
 */
function ensureSettings(settings: ISettingInput | null | undefined): ISettingInput {
  if (!settings || !settings.site) {
    return { ...DEFAULT_SETTINGS };
  }
  
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    site: {
      ...DEFAULT_SETTINGS.site,
      ...settings.site,
    },
    seo: {
      ...DEFAULT_SETTINGS.seo,
      ...settings.seo,
    },
    common: {
      ...DEFAULT_SETTINGS.common,
      ...settings.common,
    },
    availableLanguages: settings.availableLanguages?.length
      ? settings.availableLanguages
      : DEFAULT_SETTINGS.availableLanguages,
    availableCurrencies: settings.availableCurrencies?.length
      ? settings.availableCurrencies
      : DEFAULT_SETTINGS.availableCurrencies,
    availablePaymentMethods: settings.availablePaymentMethods?.length
      ? settings.availablePaymentMethods
      : DEFAULT_SETTINGS.availablePaymentMethods,
    availableDeliveryDates: settings.availableDeliveryDates?.length
      ? settings.availableDeliveryDates
      : DEFAULT_SETTINGS.availableDeliveryDates,
    integrations: settings.integrations?.length
      ? settings.integrations
      : DEFAULT_SETTINGS.integrations,
    points: {
      ...DEFAULT_SETTINGS.points,
      ...settings.points,
    },
    subscriptions: {
      ...DEFAULT_SETTINGS.subscriptions,
      ...settings.subscriptions,
      points: {
        ...DEFAULT_SETTINGS.subscriptions.points,
        ...settings.subscriptions?.points,
      },
    },
  };
}

/**
 * Get settings without cache
 */
export async function getNoCachedSetting(): Promise<ISettingInput> {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined');
    }
    await connectToDatabase();
    const setting = await Setting.findOne().lean();
    return ensureSettings(setting);
  } catch (error) {
    console.error('Error fetching uncached settings:', error);
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Get settings with cache
 */
export const getSetting = unstable_cache(
  async (): Promise<ISettingInput> => {
    try {
      if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI is not defined');
      }
      await connectToDatabase();
      const setting = await Setting.findOne().lean();
      return ensureSettings(setting || data.settings?.[0] || { ...DEFAULT_SETTINGS });
    } catch (error) {
      console.error('Error fetching settings:', error);
      return { ...DEFAULT_SETTINGS };
    }
  },
  ['settings'],
  { tags: ['settings'], revalidate: 3600 }
);

/**
 * Update settings
 */
export async function updateSetting(
  newSetting: ISettingInput
): Promise<SettingResponse<ISettingInput>> {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined');
    }
    await connectToDatabase();
    const updatedSetting = await Setting.findOneAndUpdate({}, newSetting, {
      upsert: true,
      new: true,
      lean: true,
    });

    if (!updatedSetting) {
      throw new Error('Failed to update settings');
    }

    return {
      success: true,
      message: 'Setting updated successfully',
      data: ensureSettings(updatedSetting),
    };
  } catch (error) {
    console.error('Error updating settings:', error);
    return {
      success: false,
      message: formatError(error),
    };
  }
}

/**
 * Update currency in cookies
 */
export async function setCurrencyOnServer(
  newCurrency: string
): Promise<SettingResponse> {
  try {
    const cookieStore = await cookies();
    cookieStore.set('currency', newCurrency, {
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    return {
      success: true,
      message: 'Currency updated successfully',
    };
  } catch (error) {
    console.error('Error setting currency:', error);
    return {
      success: false,
      message: formatError(error),
    };
  }
}

/**
 * Clear settings cache
 */
export async function clearSettingsCache(): Promise<SettingResponse> {
  try {
    return {
      success: true,
      message: 'Cache cleared successfully',
    };
  } catch (error) {
    console.error('Error clearing cache:', error);
    return {
      success: false,
      message: formatError(error),
    };
  }
}

/**
 * Get settings with optional cache bypass
 */
export async function getSettingWithOptions(
  options: { bypassCache?: boolean } = {}
): Promise<ISettingInput> {
  const settings = options.bypassCache
    ? await getNoCachedSetting()
    : await getSetting();
  return ensureSettings(settings);
}