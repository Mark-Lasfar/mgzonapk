// /app/[locale]/(root)/integrations/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { useToast } from '@/components/ui/toast';
import { Star } from 'lucide-react';

interface Integration {
  _id: string;
  name: string;
  logoUrl?: string;
  description?: string;
  categories?: string[];
  rating?: number;
  ratingsCount?: number;
  installs?: number;
  slug: string;
  source: 'admin' | 'developer';
  status: 'pending' | 'approved' | 'rejected';
}

export default function IntegrationsPage() {
  const t = useTranslations('integrations');
  const { toast } = useToast();
  const router = useRouter();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchIntegrations() {
      try {
        setIsLoading(true);
        const [adminResponse, developerResponse] = await Promise.all([
          fetch('/api/seller/integrations'),
          fetch('/api/seller/developer-clients?status=approved'),
        ]);

        const integrationsData: Integration[] = [];

        if (adminResponse.ok) {
          const adminData = await adminResponse.json();
          if (adminData.success && adminData.data) {
            integrationsData.push(
              ...adminData.data.map((item: any) => ({
                ...item,
                name: item.providerName,
                source: 'admin',
                slug: item.slug || item.providerName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                status: item.status || 'approved',
              }))
            );
          }
        }

        if (developerResponse.ok) {
          const developerData = await developerResponse.json();
          if (developerData.success && developerData.data.clients) {
            integrationsData.push(
              ...developerData.data.clients.map((client: any) => ({
                _id: client._id,
                name: client.name,
                logoUrl: client.logoUrl,
                description: client.description,
                categories: client.categories,
                rating: client.rating,
                ratingsCount: client.ratingsCount,
                installs: client.installs,
                slug: client.slug,
                source: 'developer',
                status: client.status,
              }))
            );
          }
        }

        // Filter out pending apps for non-admin users
        setIntegrations(integrationsData.filter((integration) => integration.status === 'approved'));
      } catch (error) {
        toast({
          variant: 'destructive',
          title: t('error.title'),
          description: String(error),
        });
      } finally {
        setIsLoading(false);
      }
    }
    fetchIntegrations();
  }, [t, toast]);

  if (isLoading) {
    return <div className="container mx-auto p-6">{t('loading')}</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">{t('title')}</h1>
      {integrations.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">{t('noIntegrationsFound')}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {integrations.map((integration) => (
            <Card
              key={integration._id}
              className="hover:shadow-lg transition cursor-pointer"
              onClick={() => router.push(`/integrations/${integration.slug}`)}
            >
              <CardHeader>
                <div className="flex items-center gap-4">
                  {integration.logoUrl && (
                    <Image
                      src={integration.logoUrl}
                      alt={integration.name}
                      width={60}
                      height={60}
                      className="object-contain"
                    />
                  )}
                  <CardTitle>{integration.name}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  {integration.description || t('no_description')}
                </p>
                {integration.categories && integration.categories.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {integration.categories.map((category, index) => (
                      <span
                        key={index}
                        className="inline-block bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-3 py-1 rounded-full text-sm"
                      >
                        {t(category)}
                      </span>
                    ))}
                  </div>
                )}
                {integration.rating && (
                  <div className="flex items-center mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`h-5 w-5 ${
                          i < Math.round(integration.rating!) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'
                        }`}
                      />
                    ))}
                    <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                      {integration.rating.toFixed(1)} ({integration.ratingsCount || 0} {t('reviews')})
                    </span>
                  </div>
                )}
                <Button
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/integrations/${integration.slug}`);
                  }}
                >
                  {t('viewDetails')}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}