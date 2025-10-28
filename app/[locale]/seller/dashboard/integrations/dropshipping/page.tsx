'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Image from 'next/image';
import { useToast } from '@/components/ui/toast';

export default function DropshippingPage() {
  const t = useTranslations('seller dashboard integrations dropshipping');
  const router = useRouter();
  const { toast } = useToast();
  const [integrations, setIntegrations] = useState([]);

  useEffect(() => {
    async function fetchIntegrations() {
      try {
        const response = await fetch('/api/integrations?type=dropshipping');
        if (!response.ok) throw new Error('Failed to fetch dropshipping integrations');
        const data = await response.json();
        setIntegrations(data.data);
      } catch (error) {
        toast({
          variant: 'destructive',
          title: t('errorTitle'),
          description: String(error),
        });
      }


    }
    fetchIntegrations();
  }, []);

  const handleInstall = async (integration: any) => {
    try {
      const response = await fetch(`/api/integrations/oauth/authorize?providerId=${integration._id}`);
      if (!response.ok) throw new Error('Failed to initiate OAuth');
      router.push(response.url);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('errorTitle'),
        description: String(error),
      });
    }
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">{t('title')}</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {integrations.map((integration: any) => (
          <Card key={integration._id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center space-x-4">
                {integration.logoUrl && (
                  <Image
                    src={integration.logoUrl}
                    alt={integration.providerName}
                    width={50}
                    height={50}
                    className="object-contain"
                  />
                )}
                <CardTitle>{integration.providerName}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">{integration.description}</p>
              {integration.articles?.[0] && (
                <div className="mb-4">
                  <h4 className="font-semibold">{integration.articles[0].title}</h4>
                  <p className="text-sm text-muted-foreground">{integration.articles[0].content.slice(0, 100)}...</p>
                </div>
              )}
              <Button
                onClick={() => router.push(`/seller/dashboard/integrations/${integration.providerName.toLowerCase()}`)}
                variant="outline"
                className="mr-2"
              >
                {t('viewDetails')}
              </Button>
              <Button onClick={() => handleInstall(integration)}>{t('install')}</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}