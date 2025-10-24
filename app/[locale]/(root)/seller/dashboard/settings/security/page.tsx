'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { UseFormReturn } from 'react-hook-form';
import ApiKeysManager from '@/components/seller/ApiKeysManager';
import { SettingsFormData } from '@/lib/types/settings';

interface SecuritySettingsProps {
  userId: string;
  form: UseFormReturn<SettingsFormData>;
  locale: string;
}

export default function SecuritySettings({ userId, form, locale }: SecuritySettingsProps) {
  const t = useTranslations('securityapiKeys');

  return (
    <div className="space-y-6">
      <h2>{t('title')}</h2>
      <ApiKeysManager userId={userId} locale={locale} />
    </div>
  );
}