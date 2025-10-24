'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import { toast } from 'react-toastify';
import { useSession } from 'next-auth/react';

export default function DocxExport() {
  const t = useTranslations('AccountPortfolio');
  const { data: session, status } = useSession();

  const handleExportDocx = async () => {
    if (status === 'unauthenticated' || !session?.user) {
      toast.error(t('notLoggedIn'));
      return;
    }

    const username = session.user.nickname ?? session.user.email?.split('@')[0] ?? 'user';

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACK_API_URL}/api/profile/docx/${username}`
      );

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${username}_resume.docx`;
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success(t('exportSuccess'));
      } else {
        const data = await response.json();
        toast.error(data.error || t('operationFailed'));
      }
    } catch (error) {
      toast.error(t('operationFailed'));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('exportDocx')}</CardTitle>
      </CardHeader>
      <CardContent>
        <Button onClick={handleExportDocx} disabled={status === 'loading'}>
          {t('downloadDocx')}
        </Button>
      </CardContent>
    </Card>
  );
}