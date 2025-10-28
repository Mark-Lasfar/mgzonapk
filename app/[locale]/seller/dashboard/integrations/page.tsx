'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Image from 'next/image';
import { useToast } from '@/components/ui/toast';
import { Star, Filter, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

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
  status: 'connected' | 'disconnected' | 'expired' | 'needs_reauth';
}

const categories = [
  'all',
  'payment',
  'warehouse',
  'dropshipping',
  'marketplace',
  'shipping',
  'marketing',
  'accounting',
  'crm',
  'analytics',
  'automation',
  'communication',
  'education',
  'security',
  'advertising',
  'tax',
  'other',
];

const ratingFilters = ['all', '4+', '3+', '2+'];
const installsFilters = ['all', '1000+', '500+', '100+'];
const statusFilters = ['all', 'connected', 'disconnected'];

export default function IntegrationsPage() {
  const t = useTranslations('seller.dashboard.integrations');
  const router = useRouter();
  const { toast } = useToast();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [filteredIntegrations, setFilteredIntegrations] = useState<Integration[]>([]);
  const [filterType, setFilterType] = useState('all');
  const [filterRating, setFilterRating] = useState('all');
  const [filterInstalls, setFilterInstalls] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [sandbox, setSandbox] = useState(false);

  useEffect(() => {
    const fetchIntegrations = async () => {
      try {
        setIsLoading(true);
        const [adminResponse, developerResponse] = await Promise.all([
          fetch(`/api/seller/integrations?sandbox=${sandbox}`),
          fetch(`/api/seller/developer-clients?sandbox=${sandbox}`),
        ]);

        if (!adminResponse.ok) throw new Error(t('fetch_error'));
        if (!developerResponse.ok) throw new Error(t('fetch_developer_error'));

        const { data: adminData } = await adminResponse.json();
        const { data: developerData } = await developerResponse.json();

        const adminIntegrations = adminData.map((int: any) => ({
          ...int,
          name: int.providerName,
          source: 'admin',
          features: int.features || [],
          categories: int.categories || [],
          rating: int.rating || 0,
          ratingsCount: int.ratingsCount || 0,
          installs: int.installs || 0,
          slug: int.slug || int.providerName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        }));

        const developerIntegrations = developerData.clients
          .filter((client: any) => client.status === 'approved')
          .map((client: any) => ({
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
            connected: client.connected || false,
            status: client.status || 'disconnected',
            source: 'developer',
          }));

        const combinedIntegrations = [...adminIntegrations, ...developerIntegrations];
        setIntegrations(combinedIntegrations);
        setFilteredIntegrations(combinedIntegrations);
      } catch (error) {
        toast({ variant: 'destructive', title: t('error_title'), description: String(error) });
      } finally {
        setIsLoading(false);
      }
    };
    fetchIntegrations();
  }, [sandbox, t, toast]);

  useEffect(() => {
    let filtered = [...integrations];

    // Filter by category
    if (filterType !== 'all') {
      filtered = filtered.filter((int) => int.categories?.includes(filterType));
    }

    // Filter by rating
    if (filterRating !== 'all') {
      const minRating = parseInt(filterRating);
      filtered = filtered.filter((int) => int.rating && int.rating >= minRating);
    }

    // Filter by installs
    if (filterInstalls !== 'all') {
      const minInstalls = parseInt(filterInstalls);
      filtered = filtered.filter((int) => int.installs && int.installs >= minInstalls);
    }

    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter((int) => int.status === filterStatus);
    }

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(
        (int) =>
          int.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          int.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredIntegrations(filtered);
  }, [filterType, filterRating, filterInstalls, filterStatus, searchQuery, integrations]);

  const handleConnect = async (integrationId: string, source: 'admin' | 'developer') => {
    try {
      const endpoint =
        source === 'admin'
          ? `/api/integrations/${integrationId}/connect?sandbox=${sandbox}`
          : `/api/clients/${integrationId}/connect?sandbox=${sandbox}`;
      const response = await fetch(endpoint, { method: 'POST' });
      if (!response.ok) throw new Error(t('connect_error'));
      const { redirectUrl } = await response.json();
      window.location.href = redirectUrl;
    } catch (error) {
      toast({ variant: 'destructive', title: t('error_title'), description: String(error) });
    }
  };

  const handleDisconnect = async (integrationId: string, source: 'admin' | 'developer') => {
    try {
      const endpoint =
        source === 'admin'
          ? `/api/integrations/${integrationId}/disconnect?sandbox=${sandbox}`
          : `/api/clients/${integrationId}/disconnect?sandbox=${sandbox}`;
      const response = await fetch(endpoint, { method: 'DELETE' });
      if (!response.ok) throw new Error(t('disconnect_error'));
      setIntegrations(
        integrations.map((int) =>
          int._id === integrationId ? { ...int, connected: false, status: 'disconnected' } : int
        )
      );
      toast({ title: t('success_title'), description: t('disconnected') });
    } catch (error) {
      toast({ variant: 'destructive', title: t('error_title'), description: String(error) });
    }
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">{t('title')}</h1>

      {/* Filters Section */}
      <div className="mb-6 flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder={t('search_placeholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
          />
        </div>
        <div className="flex gap-4 items-center">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[180px] bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
              <SelectValue placeholder={t('filter_category')} />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {t(category)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterRating} onValueChange={setFilterRating}>
            <SelectTrigger className="w-[120px] bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
              <SelectValue placeholder={t('filter_rating')} />
            </SelectTrigger>
            <SelectContent>
              {ratingFilters.map((rating) => (
                <SelectItem key={rating} value={rating}>
                  {t(rating)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[150px] bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
              <SelectValue placeholder={t('filter_status')} />
            </SelectTrigger>
            <SelectContent>
              {statusFilters.map((status) => (
                <SelectItem key={status} value={status}>
                  {t(status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center space-x-2">
            <Switch
              checked={sandbox}
              onCheckedChange={setSandbox}
              id="sandbox-mode"
              className="data-[state=checked]:bg-blue-600"
            />
            <Label htmlFor="sandbox-mode" className="text-gray-700 dark:text-gray-300">
              {t('sandbox_mode')}
            </Label>
          </div>
        </div>
      </div>

      {/* Integrations Grid */}
      {isLoading ? (
        <div className="text-center py-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600 dark:text-gray-400">{t('loading')}</span>
        </div>
      ) : filteredIntegrations.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <p className="text-gray-600 dark:text-gray-400">{t('no_integrations')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredIntegrations.map((integration) => (
            <Card
              key={integration._id}
              className="hover:shadow-lg transition-shadow bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-4 mb-4">
                  {integration.logoUrl ? (
                    <Image
                      src={integration.logoUrl}
                      alt={integration.name}
                      width={60}
                      height={60}
                      className="object-contain rounded"
                    />
                  ) : (
                    <div className="w-[60px] h-[60px] bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                      <span className="text-gray-500 dark:text-gray-400 text-2xl">
                        {integration.name.charAt(0)}
                      </span>
                    </div>
                  )}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      <a
                        href={`/integrations/${integration.slug}`}
                        className="hover:underline"
                      >
                        {integration.name}
                      </a>
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {t('by')} {integration.source === 'admin' ? 'Admin' : 'Developer'}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">
                  {integration.description || t('no_description')}
                </p>
                {integration.rating ? (
                  <div className="flex items-center mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${
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
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                    {t('installs')}: {integration.installs}
                  </p>
                ) : null}
                {integration.categories && integration.categories.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {integration.categories.slice(0, 3).map((category, index) => (
                      <Badge key={index} variant="secondary" className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                        {t(category)}
                      </Badge>
                    ))}
                    {integration.categories.length > 3 && (
                      <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                        +{integration.categories.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
                <div className="flex gap-2">
                  {integration.connected ? (
                    <Button
                      variant="destructive"
                      onClick={() => handleDisconnect(integration._id, integration.source)}
                    >
                      {t('disconnect')}
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleConnect(integration._id, integration.source)}
                    >
                      {t('install')}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => router.push(`/seller/dashboard/integrations/${integration.slug}`)}
                  >
                    {t('manage')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}