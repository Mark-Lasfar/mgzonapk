// /app/[locale]/(auth)/callback/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

export default function AuthCallbackPage() {
  const t = useTranslations('Auth');
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    const refreshToken = searchParams.get('refreshToken');
    const provider = searchParams.get('provider');
    const error = searchParams.get('error');
    const successRedirect = searchParams.get('success_redirect') || '/seller/integrations';

    if (error) {
      router.replace(`/login?error=${encodeURIComponent(error)}`);
      return;
    }

    if (token) {
      localStorage.setItem('userToken', token);
      if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
      if (provider) localStorage.setItem('authProvider', provider);
      router.replace(successRedirect);
    } else {
      router.replace(`/login?error=${encodeURIComponent(t('errors.oauth_failed'))}`);
    }
  }, [router, searchParams, t]);

  return <p>{t('loading')}</p>;
}