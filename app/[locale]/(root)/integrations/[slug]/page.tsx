// /app/[locale]/(root)/integrations/[slug]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Image from 'next/image';
import { useToast } from '@/components/ui/toast';
import { Star } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Integration {
  _id: string;
  name: string;
  type: string;
  logoUrl?: string;
  description?: string;
  videos?: Array<{ url: string; position: 'left' | 'center' | 'right'; size: 'small' | 'medium' | 'large' }>;
  images?: Array<{ url: string; position: 'left' | 'center' | 'right'; size: 'small' | 'medium' | 'large' }>;
  buttons?: Array<{ label: string; link: string; type: 'primary' | 'secondary' | 'link' }>;
  features?: string[];
  categories?: string[];
  rating?: number;
  ratingsCount?: number;
  installs?: number;
  slug: string;
  commissionRate?: number;
  source: 'admin' | 'developer';
  connected: boolean;
  status: 'connected' | 'disconnected' | 'expired' | 'needs_reauth' | 'pending' | 'approved' | 'rejected';
}

export default function IntegrationLandingPage() {
  const t = useTranslations('integrations.landing');
  const { toast } = useToast();
  const { slug } = useParams();
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSandbox, setIsSandbox] = useState(false);

  useEffect(() => {
    async function fetchIntegration() {
      try {
        setIsLoading(true);
        const [adminResponse, developerResponse] = await Promise.all([
          fetch(`/api/seller/integrations?provider=${slug}&sandbox=${isSandbox}`),
          fetch(`/api/seller/developer-clients?slug=${slug}&sandbox=${isSandbox}`),
        ]);

        let data: Integration | null = null;
        if (adminResponse.ok) {
          const adminData = await adminResponse.json();
          if (adminData.success && adminData.data && adminData.data.length > 0) {
            data = {
              ...adminData.data[0],
              name: adminData.data[0].providerName,
              source: 'admin',
              slug: adminData.data[0].slug || adminData.data[0].providerName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
              features: adminData.data[0].features || [],
              categories: adminData.data[0].categories || [],
              rating: adminData.data[0].rating || 0,
              ratingsCount: adminData.data[0].ratingsCount || 0,
              installs: adminData.data[0].installs || 0,
              status: adminData.data[0].status || 'approved',
            };
          }
        }
        if (!data && developerResponse.ok) {
          const developerData = await developerResponse.json();
          if (developerData.success && developerData.data.clients && developerData.data.clients.length > 0) {
            const client = developerData.data.clients[0];
            if (client.status === 'approved') {
              data = {
                _id: client._id,
                name: client.name,
                type: client.categories?.[0] || 'other',
                logoUrl: client.logoUrl,
                description: client.description,
                videos: client.videos,
                images: client.images,
                buttons: client.buttons,
                features: client.features,
                categories: client.categories,
                rating: client.rating || 0,
                ratingsCount: client.ratingsCount || 0,
                installs: client.installs || 0,
                slug: client.slug,
                commissionRate: client.commissionRate,
                source: 'developer',
                connected: client.connected || false,
                status: client.status || 'disconnected',
              };
            } else {
              toast({
                variant: 'destructive',
                title: t('error_title'),
                description: t('app_not_approved'),
              });
            }
          }
        }

        if (!data) {
          notFound();
        }

        setIntegration(data);
      } catch (error) {
        toast({ variant: 'destructive', title: t('error_title'), description: String(error) });
      } finally {
        setIsLoading(false);
      }
    }
    fetchIntegration();
  }, [slug, isSandbox, t, toast]);

  const handleConnect = async () => {
    if (!integration) return;
    if (integration.status !== 'approved') {
      toast({
        variant: 'destructive',
        title: t('error_title'),
        description: t('app_not_approved'),
      });
      return;
    }
    setIsConnecting(true);
    try {
      const endpoint =
        integration.source === 'admin'
          ? `/api/integrations/${integration._id}/connect?sandbox=${isSandbox}`
          : `/api/clients/${integration._id}/connect?sandbox=${isSandbox}`;
      const response = await fetch(endpoint, { method: 'POST' });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || t('connect_error'));
      }
      const { redirectUrl } = await response.json();
      if (redirectUrl) {
        window.location.href = redirectUrl;
      } else {
        setIntegration({ ...integration, connected: true, status: 'connected' });
        toast({ title: t('success_title'), description: t('connected') });
      }
    } catch (error) {
      toast({ variant: 'destructive', title: t('error_title'), description: String(error) });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!integration) return;
    setIsConnecting(true);
    try {
      const endpoint =
        integration.source === 'admin'
          ? `/api/integrations/${integration._id}/disconnect?sandbox=${isSandbox}`
          : `/api/clients/${integration._id}/disconnect?sandbox=${isSandbox}`;
      const response = await fetch(endpoint, { method: 'DELETE' });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || t('disconnect_error'));
      }
      setIntegration({ ...integration, connected: false, status: 'disconnected' });
      toast({ title: t('success_title'), description: t('disconnected') });
    } catch (error) {
      toast({ variant: 'destructive', title: t('error_title'), description: String(error) });
    } finally {
      setIsConnecting(false);
    }
  };

  if (isLoading || !integration) {
    return <div className="container mx-auto p-6 text-gray-900 dark:text-white">{t('loading')}</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-4">
              {integration.logoUrl && (
                <Image
                  src={integration.logoUrl}
                  alt={integration.name}
                  width={80}
                  height={80}
                  className="object-contain"
                />
              )}
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{integration.name}</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('by')} {integration.source === 'admin' ? 'Admin' : 'Developer'}
                </p>
              </div>
            </div>
            {integration.status === 'pending' && (
              <div className="mb-4">
                <span className="inline-block bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-3 py-1 rounded-full text-sm">
                  {t('pending_approval')}
                </span>
              </div>
            )}
            <div className="flex items-center mb-4">
              {integration.rating ? (
                <div className="flex items-center">
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
              ) : null}
              {integration.installs ? (
                <span className="ml-4 text-sm text-gray-600 dark:text-gray-400">
                  {integration.installs} {t('installs')}
                </span>
              ) : null}
            </div>
            <p className="text-gray-600 dark:text-gray-300 mb-4">{integration.description || t('no_description')}</p>
            {integration.categories && integration.categories.length > 0 && (
              <div className="mb-4">
                <span className="font-medium text-gray-700 dark:text-gray-300">{t('categories')}:</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {integration.categories.map((category, index) => (
                    <span
                      key={index}
                      className="inline-block bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-3 py-1 rounded-full text-sm"
                    >
                      {t(category)}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {integration.commissionRate !== undefined && (
              <p className="mb-4 text-gray-600 dark:text-gray-300">
                {t('commission_rate')}: {(integration.commissionRate * 100).toFixed(2)}%
              </p>
            )}
            <div className="flex gap-4 mb-4">
              {integration.status === 'approved' && (
                <>
                  {integration.connected ? (
                    <Button
                      variant="destructive"
                      onClick={handleDisconnect}
                      disabled={isConnecting}
                      className="bg-red-600 dark:bg-red-700 hover:bg-red-700 dark:hover:bg-red-800"
                    >
                      {t('disconnect')}
                    </Button>
                  ) : (
                    <Button
                      onClick={handleConnect}
                      disabled={isConnecting}
                      className="bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-800"
                    >
                      {isConnecting ? t('connecting') : t('install')}
                    </Button>
                  )}
                </>
              )}
              {integration.buttons?.map((button) => (
                <Button
                  key={button.label}
                  variant={button.type === 'primary' ? 'default' : button.type === 'secondary' ? 'outline' : 'link'}
                  onClick={() => window.open(button.link, '_blank')}
                  className={
                    button.type === 'primary'
                      ? 'bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-800'
                      : button.type === 'secondary'
                      ? 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                      : 'text-blue-600 dark:text-blue-400'
                  }
                >
                  {button.label}
                </Button>
              ))}
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={isSandbox}
                onChange={() => setIsSandbox(!isSandbox)}
                id="sandbox-mode"
                className="h-4 w-4 text-blue-600 dark:text-blue-400"
              />
              <label htmlFor="sandbox-mode" className="text-gray-700 dark:text-gray-300">
                {t('sandbox_mode')}
              </label>
            </div>
          </div>
          {integration.images?.[0] && (
            <div className="flex-shrink-0">
              <Image
                src={integration.images[0].url}
                alt={integration.name}
                width={integration.images[0].size === 'large' ? 400 : integration.images[0].size === 'medium' ? 300 : 200}
                height={integration.images[0].size === 'large' ? 400 : integration.images[0].size === 'medium' ? 300 : 200}
                className={`rounded-lg ${
                  integration.images[0].position === 'center' ? 'mx-auto' : integration.images[0].position === 'left' ? 'mr-auto' : 'ml-auto'
                }`}
              />
            </div>
          )}
        </div>

        <Tabs defaultValue="overview" className="mt-6">
          <TabsList className="bg-gray-100 dark:bg-gray-700">
            <TabsTrigger value="overview" className="text-gray-900 dark:text-white">{t('overview')}</TabsTrigger>
            <TabsTrigger value="features" className="text-gray-900 dark:text-white">{t('features')}</TabsTrigger>
            <TabsTrigger value="media" className="text-gray-900 dark:text-white">{t('media')}</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white">{t('overview')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-300">{integration.description || t('no_description')}</p>
                {integration.features && integration.features.length > 0 && (
                  <div className="mt-4">
                    <h3 className="font-semibold text-lg text-gray-900 dark:text-white">{t('key_features')}</h3>
                    <ul className="list-disc pl-5 mt-2">
                      {integration.features.map((feature, index) => (
                        <li key={index} className="text-gray-600 dark:text-gray-300">{feature}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="features">
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white">{t('features')}</CardTitle>
              </CardHeader>
              <CardContent>
                {integration.features && integration.features.length > 0 ? (
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {integration.features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                        <span className="h-2 w-2 bg-blue-500 rounded-full"></span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-600 dark:text-gray-300">{t('no_features')}</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="media">
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white">{t('media')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {integration.images?.map((image, index) => (
                    <Image
                      key={index}
                      src={image.url}
                      alt={`${integration.name} Image ${index + 1}`}
                      width={image.size === 'large' ? 400 : image.size === 'medium' ? 300 : 200}
                      height={image.size === 'large' ? 400 : image.size === 'medium' ? 300 : 200}
                      className={`rounded-lg ${
                        image.position === 'center' ? 'mx-auto' : image.position === 'left' ? 'mr-auto' : 'ml-auto'
                      }`}
                    />
                  ))}
                  {integration.videos?.map((video, index) => (
                    <video
                      key={index}
                      src={video.url}
                      controls
                      className={`rounded-lg ${
                        video.size === 'large' ? 'w-full' : video.size === 'medium' ? 'w-3/4' : 'w-1/2'
                      } ${video.position === 'center' ? 'mx-auto' : video.position === 'left' ? 'mr-auto' : 'ml-auto'}`}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}