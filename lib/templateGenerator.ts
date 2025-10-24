import { connectToDatabase } from '@/lib/db';
import Seller from '@/lib/db/models/seller.model';
import TemplateSettings from '@/lib/db/models/templateSettings.model';
import { ISettingInput } from '@/types';
import { getSetting } from './actions/setting.actions';
import crypto from 'crypto';

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
  sandbox?: boolean;
  verified: boolean;
}

interface TemplateConfig {
  templateId: string;
  sellerId: string;
  theme: string;
  font: string;
  colors: {
    primary: string;
    secondary: string;
    background: string;
    accent?: string;
  };
  components: string[];
  layout: {
    header: string;
    footer: string;
    main: string[];
    sidebar?: string[];
  };
  testimonials: Testimonial[];
  shippingOptions: ShippingOption[];
  discountOffers: DiscountOffer[];
  paymentGateways: PaymentGateway[];
  backgroundImage?: string;
  seo: {
    metaTitle: string;
    metaDescription: string;
    keywords: string[];
  };
  analytics: {
    provider: string;
    trackingId?: string;
  };
  abTesting?: {
    experimentId: string;
    variants: string[];
  };
  multiLanguage: {
    defaultLocale: string;
    supportedLocales: string[];
  };
  customCSS?: string;
  customJS?: string;
}

const shuffleArray = <T>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

const getRandomInt = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

export async function generateUniqueTemplate(
  sellerId: string,
  existingTemplates: TemplateConfig[]
): Promise<TemplateConfig> {
  await connectToDatabase();

  // Fetch seller data
  const seller = await Seller.findById(sellerId);
  if (!seller) {
    throw new Error('Seller not found');
  }

  // Fetch active template settings
  const templateSettings = await TemplateSettings.findOne({ isActive: true });
  if (!templateSettings) {
    throw new Error('No active template settings found');
  }

  // Fetch system settings
  const settings: ISettingInput = await getSetting();
  const defaultLocale = settings.defaultLanguage || 'en';
  const supportedLocales = settings.availableLanguages.map(lang => lang.code);

  let template: TemplateConfig;
  let attempts = 0;
  const maxAttempts = 10;

  do {
    attempts++;
    const selectedComponents = shuffleArray(templateSettings.components).slice(0, getRandomInt(3, templateSettings.components.length));
    const selectedTheme = seller.settings.customSite.theme || templateSettings.themes[getRandomInt(0, templateSettings.themes.length - 1)];
    const primaryColor = seller.settings.customSite.primaryColor || templateSettings.colors[getRandomInt(0, templateSettings.colors.length - 1)];
    const secondaryColor = templateSettings.colors.filter(c => c !== primaryColor)[getRandomInt(0, templateSettings.colors.length - 2)];

    template = {
      templateId: crypto.randomUUID(),
      sellerId,
      theme: selectedTheme,
      font: seller.settings.language === 'ar' ? 'Tajawal' : templateSettings.fonts[getRandomInt(0, templateSettings.fonts.length - 1)],
      colors: {
        primary: primaryColor,
        secondary: secondaryColor,
        background: selectedTheme === 'light' ? '#ffffff' : '#1a1a1a',
        accent: templateSettings.colors[getRandomInt(0, templateSettings.colors.length - 1)],
      },
      components: selectedComponents,
      layout: {
        header: seller.settings.customSite.customSections?.find(s => s.title === 'Header')?.content || templateSettings.layout.header,
        footer: seller.settings.customSite.customSections?.find(s => s.title === 'Footer')?.content || templateSettings.layout.footer,
        main: selectedComponents,
        sidebar: seller.settings.customSite.customSections?.filter(s => s.title.includes('Sidebar')).map(s => s.content) || templateSettings.layout.sidebar || [],
      },
      testimonials: shuffleArray(templateSettings.testimonials).slice(0, getRandomInt(2, templateSettings.testimonials.length)),
      shippingOptions: seller.shippingOptions || templateSettings.shippingOptions,
      discountOffers: seller.discountOffers || templateSettings.discountOffers,
      paymentGateways: seller.paymentGateways || templateSettings.paymentGateways,
      backgroundImage: seller.settings.customSite.bannerImage || templateSettings.backgrounds[getRandomInt(0, templateSettings.backgrounds.length - 1)],
      seo: {
        metaTitle: seller.settings.customSite.seo?.metaTitle || `${seller.businessName} Store`,
        metaDescription: seller.settings.customSite.seo?.metaDescription || `Shop at ${seller.businessName} for the best products`,
        keywords: seller.settings.customSite.seo?.keywords || [seller.businessName, ...settings.site.keywords.split(',')],
      },
      analytics: {
        provider: seller.integrations?.analytics?.providerName || templateSettings.analytics.provider,
        trackingId: seller.integrations?.analytics?.metadata?.trackingId || templateSettings.analytics.trackingId,
      },
      abTesting: seller.settings.abTesting.enabled
        ? {
            experimentId: crypto.randomUUID(),
            variants: seller.settings.abTesting.experiments.map(exp => exp.variant),
          }
        : undefined,
      multiLanguage: {
        defaultLocale: templateSettings.multiLanguage.defaultLocale,
        supportedLocales: templateSettings.multiLanguage.supportedLocales,
      },
      customCSS: seller.settings.customSite.customSections?.find(s => s.title === 'CustomCSS')?.content || templateSettings.customCSS,
      customJS: seller.settings.customSite.customSections?.find(s => s.title === 'CustomJS')?.content || templateSettings.customJS,
    };

    const isUnique = !existingTemplates.some(existing =>
      existing.theme === template.theme &&
      existing.font === template.font &&
      existing.colors.primary === template.colors.primary &&
      existing.components.join(',') === template.components.join(',')
    );

    if (isUnique || attempts >= maxAttempts) {
      break;
    }
  } while (true);

  if (attempts >= maxAttempts) {
    console.warn('Max attempts reached, returning potentially non-unique template');
  }

  return template;
}