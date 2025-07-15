'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';

interface Integration {
  _id: string;
  providerName: string;
  type: string;
  logoUrl?: string;
  description?: string;
  connected: boolean;
  status: 'connected' | 'disconnected' | 'expired' | 'needs_reauth';
  lastUpdated?: string;
  videos?: Array<{ url: string; position: 'left' | 'center' | 'right'; size: 'small' | 'medium' | 'large' }>;
  images?: Array<{ url: string; position: 'left' | 'center' | 'right'; size: 'small' | 'medium' | 'large' }>;
  buttons?: Array<{ label: string; link: string; type: 'primary' | 'secondary' | 'link' }>;
}

export default function IntegrationsPage() {
  const t = useTranslations('seller.dashboard.integrations');
  const router = useRouter();
  const { toast } = useToast();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [sandbox, setSandbox] = useState(false);

  useEffect(() => {
    const fetchIntegrations = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/seller/integrations?sandbox=${sandbox}`);
        if (!response.ok) throw new Error(t('Fetch Error'));
        const { data } = await response.json();
        setIntegrations(data);
      } catch (error) {
        toast({ variant: 'destructive', title: t('Error Title'), description: String(error) });
      } finally {
        setIsLoading(false);
      }
    };
    fetchIntegrations();
  }, [sandbox, t]);

  const handleConnect = async (integrationId: string) => {
    try {
      const response = await fetch(`/api/integrations/oauth/authorize?providerId=${integrationId}&sandbox=${sandbox}`);
      if (!response.ok) throw new Error(t('Connect Error'));
      const { redirectUrl } = await response.json();
      window.location.href = redirectUrl;
    } catch (error) {
      toast({ variant: 'destructive', title: t('Error Title'), description: String(error) });
    }
  };

  const handleDisconnect = async (integrationId: string) => {
    try {
      const response = await fetch(`/api/integrations/${integrationId}/disconnect?sandbox=${sandbox}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(t('Disconnect Error'));
      setIntegrations(integrations.map((int) => int._id === integrationId ? { ...int, connected: false, status: 'disconnected' } : int));
      toast({ title: t('Success Title'), description: t('Disconnected') });
    } catch (error) {
      toast({ variant: 'destructive', title: t('Error Title'), description: String(error) });
    }
  };

  const filteredIntegrations = integrations.filter((int) =>
    (filterType === 'all' || int.type === filterType) &&
    int.providerName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">{t('Integrations Title')}</h1>
      <div className="flex gap-4 mb-6">
        <Input
          placeholder={t('Search Placeholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <Select onValueChange={setFilterType} defaultValue="all">
          <SelectTrigger>
            <SelectValue placeholder={t('Filter Type')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('All Types')}</SelectItem>
            <SelectItem value="warehouse">{t('Warehouse')}</SelectItem>
            <SelectItem value="payment">{t('Payment')}</SelectItem>
            <SelectItem value="dropshipping">{t('Dropshipping')}</SelectItem>
            <SelectItem value="marketplace">{t('marketplace')}</SelectItem>
            <SelectItem value="shipping">{t('Shipping')}</SelectItem>
            <SelectItem value="marketing">{t('Marketing')}</SelectItem>
            <SelectItem value="accounting">{t('Accounting')}</SelectItem>
            <SelectItem value="crm">{t('CRM')}</SelectItem>
            <SelectItem value="advertising">{t('Advertising')}</SelectItem>
            <SelectItem value="tax">{t('tax')}</SelectItem>
            <SelectItem value="other">{t('Other')}</SelectItem>
          </SelectContent>
        </Select>
        <Select onValueChange={(value) => setSandbox(value === 'true')}>
          <SelectTrigger>
            <SelectValue placeholder={t('Environment')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="false">{t('Live')}</SelectItem>
            <SelectItem value="true">{t('Sandbox')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {isLoading ? (
        <p>{t('Loading')}</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredIntegrations.map((integration) => (
            <Card key={integration._id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {integration.logoUrl && (
                    <Image src={integration.logoUrl} alt={integration.providerName} width={40} height={40} className="object-contain" />
                  )}
                  {integration.providerName}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4">{integration.description || t('No Description')}</p>
                {integration.videos?.[0] && (
                  <video
                    src={integration.videos[0].url}
                    controls
                    className={`mb-4 ${integration.videos[0].size === 'large' ? 'w-full' : integration.videos[0].size === 'medium' ? 'w-3/4' : 'w-1/2'} ${
                      integration.videos[0].position === 'center' ? 'mx-auto' : integration.videos[0].position === 'left' ? 'mr-auto' : 'ml-auto'
                    }`}
                  />
                )}
                {integration.images?.[0] && (
                  <Image
                    src={integration.images[0].url}
                    alt={integration.providerName}
                    width={integration.images[0].size === 'large' ? 300 : integration.images[0].size === 'medium' ? 200 : 100}
                    height={integration.images[0].size === 'large' ? 300 : integration.images[0].size === 'medium' ? 200 : 100}
                    className={`mb-4 ${integration.images[0].position === 'center' ? 'mx-auto' : integration.images[0].position === 'left' ? 'mr-auto' : 'ml-auto'}`}
                  />
                )}
                {integration.buttons?.map((button) => (
                  <Button
                    key={button.label}
                    variant={button.type === 'primary' ? 'default' : button.type === 'secondary' ? 'outline' : 'link'}
                    className="mr-2 mb-2"
                    onClick={() => window.open(button.link, '_blank')}
                  >
                    {button.label}
                  </Button>
                ))}
                <p className="mb-4">{t('Status')}: {t(integration.status)}</p>
                {integration.connected ? (
                  <Button variant="destructive" onClick={() => handleDisconnect(integration._id)}>
                    {t('Disconnect')}
                  </Button>
                ) : (
                  <Button 
                  onClick={() => handleConnect(integration._id)}>
                    {t('Connect')}
                  
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}