'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Image from 'next/image';
import { useToast } from '@/components/ui/use-toast';
import { useSession } from 'next-auth/react';

export default function PaymentsPage({ locale }: { locale: string }) {
  const t = useTranslations('seller.dashboard.integrations.payments');
  const router = useRouter();
  const { toast } = useToast();
  const { data: session } = useSession();
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [connectedGateways, setConnectedGateways] = useState<any[]>([]);

  useEffect(() => {
    async function fetchIntegrations() {
      try {
        const response = await fetch(`/api/integrations?type=payment&locale=${locale}`, {
          headers: { Authorization: `Bearer ${session?.accessToken}` },
        });
        if (!response.ok) throw new Error(t('errors.fetchFailed'));
        const data = await response.json();
        if (!data.success) throw new Error(data.message || t('errors.fetchFailed'));
        setIntegrations(data.data);
      } catch (error) {
        toast({
          variant: 'destructive',
          title: t('errorTitle'),
          description: String(error),
        });
      }
    }

    async function fetchConnectedGateways() {
      try {
        const response = await fetch(`/api/seller?locale=${locale}`, {
          headers: { Authorization: `Bearer ${session?.accessToken}` },
        });
        if (!response.ok) throw new Error(t('errors.fetchSellerFailed'));
        const data = await response.json();
        if (!data.success) throw new Error(data.message || t('errors.fetchSellerFailed'));
        setConnectedGateways(data.data.paymentGateways || []);
      } catch (error) {
        toast({
          variant: 'destructive',
          title: t('errorTitle'),
          description: String(error),
        });
      }
    }

    if (session?.user?.role === 'SELLER') {
      fetchIntegrations();
      fetchConnectedGateways();
    }
  }, [t, locale, session]);

  const handleInstall = async (integration: any) => {
    try {
      const response = await fetch(`/api/payments/connect/${integration.providerName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.accessToken}`,
        },
        body: JSON.stringify({ accountDetails: {} }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || t('errors.addGatewayFailed'));
      toast({ description: t('messages.paymentGatewayAdded') });
      setConnectedGateways((prev) => [
        ...prev,
        { providerName: integration.providerName, verified: true, isDefault: prev.length === 0 },
      ]);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('errorTitle'),
        description: String(error),
      });
    }
  };

  const handleRemove = async (providerName: string) => {
    try {
      const response = await fetch(`/api/seller/payment-gateway?locale=${locale}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.accessToken}`,
        },
        body: JSON.stringify({ providerName }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || t('errors.removeGatewayFailed'));
      toast({ description: t('messages.paymentGatewayRemoved') });
      setConnectedGateways((prev) => prev.filter((g) => g.providerName !== providerName));
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
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t('connectedGateways')}</CardTitle>
        </CardHeader>
        <CardContent>
          {connectedGateways.length === 0 ? (
            <p>{t('noConnectedGateways')}</p>
          ) : (
            <ul className="list-disc pl-5">
              {connectedGateways.map((gateway) => (
                <li key={gateway.providerName} className="flex justify-between items-center">
                  {gateway.providerName} ({gateway.isDefault ? t('default') : ''})
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleRemove(gateway.providerName)}
                  >
                    {t('remove')}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <h2 className="text-2xl font-bold mb-4">{t('availableGateways')}</h2>
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
              {integration.videos?.[0] && (
                <video
                  src={integration.videos[0].url}
                  controls
                  className={`mb-4 ${integration.videos[0].size === 'large' ? 'w-full' : integration.videos[0].size === 'medium' ? 'w-3/4' : 'w-1/2'} ${
                    integration.videos[0].position === 'center' ? 'mx-auto' : integration.videos[0].position === 'left' ? 'mr-auto' : 'ml-auto'
                  }`}
                />
              )}
              <Button
                onClick={() => router.push(`/seller/dashboard/integrations/${integration.providerName.toLowerCase()}`)}
                variant="outline"
                className="mr-2"
              >
                {t('viewDetails')}
              </Button>
              <Button onClick={() => handleInstall(integration)} disabled={connectedGateways.some(g => g.providerName === integration.providerName)}>
                {t('install')}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}