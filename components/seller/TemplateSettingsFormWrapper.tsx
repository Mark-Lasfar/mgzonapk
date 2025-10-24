// /components/seller/TemplateSettingsFormWrapper.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { TemplateFormData, TemplateFormDataSchema } from '@/lib/types/settings';
import TemplateSettingsForm from './TemplateSettingsForm';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

interface Props {
  defaultValues: TemplateFormData;
  locale: string;
  storeId: string;
  onChange: (templateData: TemplateFormData) => void;
}

export default function TemplateSettingsFormWrapper({ defaultValues, locale, storeId, onChange }: Props) {
  const t = useTranslations('Template');
  const form = useForm<TemplateFormData>({
    resolver: zodResolver(TemplateFormDataSchema),
    defaultValues,
    mode: 'onChange',
  });

  // Watch for changes and trigger onChange
  useEffect(() => {
    const subscription = form.watch((value) => {
      onChange(value as TemplateFormData);
    });
    return () => subscription.unsubscribe();
  }, [form, onChange]);

  return <TemplateSettingsForm form={form} locale={locale} storeId={storeId} />;
}