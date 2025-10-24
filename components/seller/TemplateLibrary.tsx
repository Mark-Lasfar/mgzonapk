// /home/mark/Music/my-nextjs-project-clean/components/seller/TemplateLibrary.tsx
'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Template } from '@/lib/types/settings';
import useSWR from 'swr'; // For performance optimization

interface Props {
  storeId: string;
  onSelect: (template: Template) => void;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function TemplateLibrary({ storeId, onSelect }: Props) {
  const t = useTranslations('TemplateLibrary');
  const { toast } = useToast();
  const { data: result, error } = useSWR('/api/templates', fetcher);

  const templates = result?.success ? result.templates : [];

  if (error) {
    toast({
      variant: 'destructive',
      title: t('error'),
      description: t('fetchTemplatesFailed'),
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          {templates.map((template: Template) => (
            <div key={template.templateId ?? `template-${Math.random()}`} className="border rounded-md p-4">
              <h3>{template.name ?? t('unnamedTemplate')}</h3>
              <p>{template.isPublic ? t('public') : t('private')}</p>
              <Button onClick={() => onSelect(template)}>{t('select')}</Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}