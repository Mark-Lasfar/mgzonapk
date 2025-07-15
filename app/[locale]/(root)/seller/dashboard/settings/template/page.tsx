'use client';
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import TemplateBuilder from '@/components/templateBuilder';
import { Button } from '@/components/ui/button';
import { useSession } from 'next-auth/react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function TemplateSettings() {
  const t = useTranslations('Template');
  const { data: session } = useSession();
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchTemplate() {
      if (!session?.user?.storeId) return;
      try {
        const res = await fetch(`/api/stores/${session.user.storeId}/template`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setTemplate(data.template);
      } catch (err) {
        setError(t('fetchError'));
      } finally {
        setLoading(false);
      }
    }
    fetchTemplate();
  }, [session, t]);

  const saveTemplate = async (newTemplate: any) => {
    try {
      const res = await fetch(`/api/stores/${session?.user?.storeId}/template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTemplate),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTemplate(data.template);
      alert(t('saveSuccess'));
    } catch (err) {
      setError(t('saveError'));
    }
  };

  if (loading) return <p>{t('loading')}</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  return (
    <Card className="p-6">
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <TemplateBuilder template={template} onSave={saveTemplate} />
      </CardContent>
    </Card>
  );
}