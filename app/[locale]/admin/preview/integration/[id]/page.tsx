'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

// Interface aligned with integration.model.ts
interface PreviewData {
  providerName: string;
  type: 'payment' | 'warehouse' | 'dropshipping' | 'marketplace' | 'shipping' | 'marketing' | 'accounting' | 'crm' | 'analytics' | 'automation' | 'communication' | 'education' | 'security' | 'advertising' | 'tax' | 'other';
  description?: string;
  logoUrl?: string;
  webhook?: {
    enabled: boolean;
    url?: string;
    secret?: string;
    events?: string[];
  };
  videos?: Array<{
    id: string;
    url: string;
    position: 'left' | 'center' | 'right';
    size: 'small' | 'medium' | 'large';
    fontSize?: string;
    fontFamily?: string;
    margin?: string;
    padding?: string;
    customPosition?: { position: 'absolute' | 'relative' | 'fixed'; top?: string; left?: string };
  }>;
  images?: Array<{
    id: string;
    url: string;
    position: 'left' | 'center' | 'right';
    size: 'small' | 'medium' | 'large';
    fontSize?: string;
    fontFamily?: string;
    margin?: string;
    padding?: string;
    customPosition?: { position: 'absolute' | 'relative' | 'fixed'; top?: string; left?: string };
  }>;
  articles?: Array<{
    id: string;
    title: string;
    content: string;
    backgroundColor?: string;
    textColor?: string;
    fontSize?: string;
    fontFamily?: string;
  }>;
  buttons?: Array<{
    id: string;
    label: string;
    link: string;
    type: 'primary' | 'secondary' | 'link';
    backgroundColor?: string;
    textColor?: string;
    borderRadius?: string;
    padding?: string;
  }>;
  dividers?: Array<{
    id: string;
    style: string;
  }>;
}

export default function IntegrationPreviewPage() {
  const t = useTranslations('admin integrations add');
  const { toast } = useToast();
  const { id } = useParams();
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch preview data
  useEffect(() => {
    const fetchPreviewData = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/admin/integrations/preview/${id}`);
        if (!response.ok) {
          throw new Error(t('error.message'));
        }
        const { data } = await response.json();
        setPreviewData(data);
      } catch (error) {
        toast({
          variant: 'destructive',
          title: t('error.title'),
          description: error instanceof Error ? error.message : t('error.message'),
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchPreviewData();
  }, [id, t, toast]);

  // Render content item
  const renderContentItem = (item: any, type: 'image' | 'video' | 'article' | 'button' | 'divider', index: number) => {
    const style: React.CSSProperties = {
      position: item.customPosition?.position || 'relative',
      top: item.customPosition?.top,
      left: item.customPosition?.left,
      margin: item.margin || '10px',
      padding: item.padding || '10px',
      fontSize: item.fontSize || '16px',
      fontFamily: item.fontFamily || 'Arial',
      backgroundColor: item.backgroundColor,
      color: item.textColor,
      borderRadius: item.borderRadius,
    };

    switch (type) {
      case 'image':
        return (
          <Image
            key={item.id}
            src={item.url || '/placeholder.png'}
            alt={`${t('integration image')} ${index + 1}`}
            width={item.size === 'small' ? 150 : item.size === 'medium' ? 300 : 600}
            height={item.size === 'small' ? 100 : item.size === 'medium' ? 200 : 400}
            className={`object-cover ${item.position}`}
            style={style}
            onError={(e) => (e.currentTarget.src = '/placeholder.png')}
          />
        );
      case 'video':
        return (
          <video
            key={item.id}
            src={item.url}
            controls
            className={`w-full ${item.size === 'small' ? 'max-w-xs' : item.size === 'medium' ? 'max-w-md' : 'max-w-lg'}`}
            style={style}
            aria-label={`${t('integration video')} ${index + 1}`}
          >
            {t('video not supported')}
          </video>
        );
      case 'article':
        return (
          <div key={item.id} style={style} aria-label={`${t('integration article')} ${index + 1}`}>
            <h4 className="text-lg font-semibold">{item.title}</h4>
            <p>{item.content}</p>
          </div>
        );
      case 'button':
        return (
          <Button
            key={item.id}
            variant={item.type === 'primary' ? 'default' : item.type === 'secondary' ? 'outline' : 'link'}
            style={{
              ...style,
              backgroundColor: item.backgroundColor || '#007bff',
              color: item.textColor || '#ffffff',
              borderRadius: item.borderRadius || '4px',
              padding: item.padding || '8px 16px',
            }}
            asChild
          >
            <a href={item.link} target="_blank" rel="noopener noreferrer" aria-label={item.label}>
              {item.label}
            </a>
          </Button>
        );
      case 'divider':
        return <hr key={item.id} style={{ border: item.style || 'solid 1px gray' }} aria-hidden="true" />;
      default:
        return null;
    }
  };

  if (isLoading) {
    return <div className="container mx-auto p-6">{t('loading')}</div>;
  }

  if (!previewData) {
    return <div className="container mx-auto p-6">{t('error.message')}</div>;
  }

  // Combine all content items in order for consistent rendering
  const contentItems = [
    ...(previewData.images || []).map(item => ({ type: 'image' as const, data: item })),
    ...(previewData.videos || []).map(item => ({ type: 'video' as const, data: item })),
    ...(previewData.articles || []).map(item => ({ type: 'article' as const, data: item })),
    ...(previewData.buttons || []).map(item => ({ type: 'button' as const, data: item })),
    ...(previewData.dividers || []).map(item => ({ type: 'divider' as const, data: item })),
  ];

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">{t('preview')} - {previewData.providerName}</h1>
      <Card>
        <CardHeader>
          <CardTitle>{previewData.providerName} ({t(`types.${previewData.type}`)})</CardTitle>
          {previewData.description && <p className="text-gray-600">{previewData.description}</p>}
        </CardHeader>
<CardContent>
  {previewData.logoUrl && (
    <Image
      src={previewData.logoUrl}
      alt={`${previewData.providerName} logo`}
      width={150}
      height={150}
      className="mb-4"
      onError={(e) => (e.currentTarget.src = '/placeholder.png')}
    />
  )}
  {previewData.webhook?.events?.length > 0 && (
    <div className="mt-4">
      <h4 className="text-lg font-semibold">{t('selected events preview')}</h4>
      <ul className="list-disc pl-5">
        {previewData.webhook.events.map((event: string, idx: number) => (
          <li key={idx}>{t(`events.${event}`)}</li>
        ))}
      </ul>
    </div>
  )}
  <div className="space-y-4">
    {contentItems.map((item, index) => (
      <div key={`${item.type}-${item.data.id || index}`}>
        {renderContentItem(item.data, item.type, index)}
      </div>
    ))}
  </div>
</CardContent>
      </Card>
    </div>
  );
}