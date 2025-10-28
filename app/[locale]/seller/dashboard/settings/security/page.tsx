'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { UseFormReturn } from 'react-hook-form';
import ApiKeysManager from '@/components/seller/ApiKeysManager';
import { SettingsFormData } from '@/lib/types/settings';
import { Loader2 } from 'lucide-react';

interface SecuritySettingsProps {
  userId: string;
  form: UseFormReturn<SettingsFormData>;
  locale: string;
  seller: string;
}

export default function SecuritySettings({ userId, form, locale, seller }: SecuritySettingsProps) {
  if (!seller) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  const t = useTranslations('securityapiKeys');

  return (
    <div className="space-y-6">
      <h2>{t('title')}</h2>
      <ApiKeysManager userId={userId} locale={locale} />
    </div>
  );
}