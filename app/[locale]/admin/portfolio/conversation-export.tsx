'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import { toast } from 'react-toastify';
import { useSession } from 'next-auth/react';

export default function ConversationExport() {
  const t = useTranslations('AdminPortfolio');
  const { data: session, status } = useSession();

  const handleExportConversations = async () => {
    if (status === 'unauthenticated' || !session?.user) {
      toast.error(t('notAuthorized'));
      return;
    }

    if (session.user.role !== 'Admin') {
      toast.error(t('notAuthorized'));
      return;
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACK_API_URL}/api/conversations/export`);

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'conversations.csv';
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
        <CardTitle>{t('exportConversations')}</CardTitle>
      </CardHeader>
      <CardContent>
        <Button onClick={handleExportConversations} disabled={status === 'loading'}>
          {t('downloadConversations')}
        </Button>
      </CardContent>
    </Card>
  );
}