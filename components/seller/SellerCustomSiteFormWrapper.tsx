// /home/mark/Music/my-nextjs-project-clean/components/seller/SellerCustomSiteFormWrapper.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SettingsFormData, SettingsFormDataSchema } from '@/lib/types/settings';
import SellerCustomSiteForm from './SellerCustomSiteForm';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

interface Props {
  defaultValues: SettingsFormData;
  locale: string;
  storeId: string;
  onChange: (customSiteData: SettingsFormData['customSite']) => void;
}

export default function SellerCustomSiteFormWrapper({ defaultValues, locale, storeId, onChange }: Props) {
  const t = useTranslations('SellerSettings');

  const form = useForm<SettingsFormData>({
    resolver: zodResolver(SettingsFormDataSchema),
    defaultValues: {
      ...defaultValues,
      customSite: {
        theme: defaultValues.customSite?.theme ?? 'default',
        primaryColor: defaultValues.customSite?.primaryColor ?? '#000000',
        logo: undefined,
        bannerImage: undefined,
        customSections: defaultValues.customSite?.customSections?.map((section) => ({
          title: section.title ?? 'Default Title',
          slug: section.slug ?? section.title.toLowerCase().replace(/\s+/g, '-') ?? `section-${Math.random().toString(36).substring(2, 8)}`,
          content: section.content ?? 'Default Content',
          type: section.type ?? 'custom',
          position: section.position ?? 0,
          customCSS: section.customCSS ?? '',
          customHTML: section.customHTML ?? '',
        })) || [
          {
            title: 'Welcome Section',
            slug: 'welcome',
            content: 'Welcome to our store!',
            type: 'hero',
            position: 1,
          },
        ],
        seo: defaultValues.customSite?.seo ?? { metaTitle: '', metaDescription: '', keywords: [] },
        domainStatus: defaultValues.customSite?.domainStatus ?? 'pending',
        customDomain: defaultValues.customSite?.customDomain ?? '',
      },
    },
    mode: 'onChange',
  });

  useEffect(() => {
    const subscription = form.watch((value) => {
      if (value.customSite) {
        const validSections = value.customSite.customSections?.filter(
          (section): section is NonNullable<typeof section> =>
            section != null &&
            section.title != null &&
            section.slug != null &&
            section.content != null &&
            section.type != null
        ).map((section) => ({
          title: section.title ?? 'Default Title',
          slug: section.slug ?? `section-${Math.random().toString(36).substring(2, 8)}`,
          content: section.content ?? 'Default Content',
          type: section.type ?? 'custom',
          position: section.position ?? 0,
          customCSS: section.customCSS ?? '',
          customHTML: section.customHTML ?? '',
        })) ?? [];

        const validSeo = value.customSite.seo
          ? {
              ...value.customSite.seo,
              keywords: value.customSite.seo.keywords?.filter((kw): kw is string => kw != null) ?? [],
            }
          : undefined;

        onChange({
          ...value.customSite,
          theme: value.customSite.theme ?? 'default',
          primaryColor: value.customSite.primaryColor ?? '#000000',
          customSections: validSections,
          seo: validSeo,
        });
      }
    });
    return () => subscription.unsubscribe();
  }, [form, onChange]);

  return <SellerCustomSiteForm form={form} locale={locale} storeId={storeId} />;
}