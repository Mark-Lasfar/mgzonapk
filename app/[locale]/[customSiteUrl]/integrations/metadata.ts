// /app/[locale]/[customSiteUrl]/integrations/metadata.ts
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getSetting } from '@/lib/actions/setting.actions';

export async function generateMetadata({ params }: { params: { customSiteUrl: string } }): Promise<Metadata> {
  const t = await getTranslations('seller.integrations');
  const settings = await getSetting();
  // const baseUrl = settings.site?.url || 'https://hager-zon.vercel.app';
  const baseUrl = settings.site?.url || process.env.NEXT_PUBLIC_BASE_URL || 'https://hager-zon.vercel.app';

  return {
    title: `${t('title', { customSiteUrl: params.customSiteUrl })} | ${settings.site?.name || 'MGZon'}`,
    description: t('description', { customSiteUrl: params.customSiteUrl }) || 'Manage your integrations for payments, shipping, and more with your custom seller page.',
    keywords: `seller integrations, ${params.customSiteUrl}, ecommerce, payment gateways, shipping methods, ${settings.site?.keywords || 'ecommerce, shopping'}`,
    openGraph: {
      title: t('title', { customSiteUrl: params.customSiteUrl }),
      description: t('description', { customSiteUrl: params.customSiteUrl }),
      images: [{ url: settings.seo?.ogImage || `${baseUrl}/icons/og-image.jpg`, alt: settings.site?.name || 'MGZon' }],
      url: `${baseUrl}/seller/${params.customSiteUrl}/integrations`,
      type: 'website',
    },
  };
}

