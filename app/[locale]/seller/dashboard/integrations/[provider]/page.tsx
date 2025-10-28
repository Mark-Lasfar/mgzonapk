'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Trash2, PlusCircle, RefreshCw, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

interface Integration {
  _id: string;
  providerName: string;
  type: string;
  logoUrl?: string;
  description?: string;
  videos?: {
    url: string;
    position?: string;
    size?: string;
    fontSize?: string;
    fontFamily?: string;
    margin?: string;
    padding?: string;
    customPosition?: { position: string; top?: string; left?: string };
  }[];
  images?: {
    url: string;
    position?: string;
    size?: string;
    fontSize?: string;
    fontFamily?: string;
    margin?: string;
    padding?: string;
    customPosition?: { position: string; top?: string; left?: string };
  }[];
  articles?: { title: string; content: string }[];
  buttons?: {
    label: string;
    link: string;
    type: 'primary' | 'secondary' | 'link';
    backgroundColor?: string;
    textColor?: string;
    borderRadius?: string;
    padding?: string;
  }[];
  dividers?: { style: string }[];
  webhook?: { enabled: boolean; url: string; events: string[]; secret: string };
  apiEndpoints?: Record<string, string>;
  credentials?: Record<string, string>;
  oauth?: { enabled: boolean; authorizationUrl?: string; tokenUrl?: string; scopes?: string[] };
  connected: boolean;
  status: string;
  lastUpdated?: string;
  inventoryStats?: { totalItems: number; lastSynced: string };
  orderStats?: { totalOrders: number; pending: number; lastSynced: string };
  pricing?: { isFree: boolean; commissionRate?: number; requiredPlanIds?: string[] };
  source: 'admin' | 'developer';
  features?: string[];
  categories?: string[];
  rating?: number;
  ratingsCount?: number;
  installs?: number;
}

const integrationUpdateSchema = z.object({
  description: z.string().max(500, 'Description cannot exceed 500 characters').optional(),
  webhook: z
    .object({
      enabled: z.boolean().default(false),
      url: z.string().url('Invalid URL').optional(),
      events: z.array(z.string()).optional(),
      secret: z.string().optional(),
    })
    .optional(),
  apiEndpoints: z.record(z.string().url('Invalid URL')).optional(),
  credentials: z.record(z.string()).optional(),
});

type IntegrationUpdateForm = z.infer<typeof integrationUpdateSchema>;

export default function ProviderIntegrationPage() {
  const t = useTranslations('seller.integrations.provider');
  const { toast } = useToast();
  const router = useRouter();
  const { provider } = useParams();
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [isSandbox, setIsSandbox] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [webhookEvents, setWebhookEvents] = useState<string[]>([]);
  const [apiEndpointsFields, setApiEndpointsFields] = useState<{ key: string; value: string }[]>([]);
  const [credentialFields, setCredentialFields] = useState<{ key: string; value: string }[]>([]);

  const form = useForm<IntegrationUpdateForm>({
    resolver: zodResolver(integrationUpdateSchema),
    defaultValues: {
      description: '',
      webhook: { enabled: false, url: '', events: [], secret: '' },
      apiEndpoints: {},
      credentials: {},
    },
  });

  // Fetch integration data
  useEffect(() => {
    async function fetchIntegration() {
      try {
        setIsLoading(true);
        const [adminResponse, developerResponse] = await Promise.all([
          fetch(`/api/seller/integrations?provider=${provider}&sandbox=${isSandbox}`),
          fetch(`/api/seller/developer-clients?slug=${provider}&sandbox=${isSandbox}`),
        ]);

        let data: Integration | null = null;
        if (adminResponse.ok) {
          const adminData = await adminResponse.json();
          if (adminData.data.length > 0) {
            data = { ...adminData.data[0], source: 'admin' };
          }
        }
        if (!data && developerResponse.ok) {
          const developerData = await developerResponse.json();
          if (developerData.data.clients.length > 0) {
            const client = developerData.data.clients[0];
            if (client.status === 'approved') {
              data = {
                _id: client._id,
                providerName: client.name,
                type: client.categories?.[0] || 'other',
                logoUrl: client.logoUrl,
                description: client.description,
                videos: client.videos,
                images: client.images,
                buttons: client.buttons,
                features: client.features,
                categories: client.categories,
                rating: client.rating,
                ratingsCount: client.ratingsCount,
                installs: client.installs,
                slug: client.slug,
                commissionRate: client.commissionRate,
                source: 'developer',
                connected: client.connected || false,
                status: client.status || 'disconnected',
                webhook: client.webhook,
                apiEndpoints: client.apiEndpoints,
                credentials: client.credentials,
                oauth: client.oauth,
              };
            }
          }
        }

        if (!data) {
          router.push('/seller/dashboard/integrations');
          toast({
            variant: 'destructive',
            title: t('error.title'),
            description: t('error.integration_not_found'),
          });
          return;
        }

        setIntegration(data);
        form.reset({
          description: data.description || '',
          webhook: data.webhook || { enabled: false, url: '', events: [], secret: '' },
          apiEndpoints: data.apiEndpoints || {},
          credentials: data.credentials || {},
        });
        setWebhookEvents(data.webhook?.events || []);
        setApiEndpointsFields(
          Object.entries(data.apiEndpoints || {}).map(([key, value]) => ({ key, value }))
        );
        setCredentialFields(
          Object.entries(data.credentials || {}).map(([key, value]) => ({ key, value }))
        );
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
    fetchIntegration();
  }, [provider, isSandbox, t, toast, form, router]);

  // Submit form updates
  const onSubmit = async (data: IntegrationUpdateForm) => {
    setIsLoading(true);
    try {
      const endpoint =
        integration?.source === 'admin'
          ? `/api/seller/integrations/${provider}`
          : `/api/seller/developer-clients/${provider}`;
      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, sandbox: isSandbox }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || t('error.update_failed'));
      }

      toast({
        title: t('success.title'),
        description: t('success.update_message'),
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('error.title'),
        description: String(error),
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Connect to integration
  const handleConnect = async () => {
    if (!integration) return;
    setIsConnecting(true);
    try {
      const endpoint =
        integration.source === 'admin'
          ? `/api/integrations/${integration._id}/connect?sandbox=${isSandbox}`
          : `/api/clients/${integration._id}/connect?sandbox=${isSandbox}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentials: form.getValues('credentials') }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || t('error.connect_failed'));
      }

      const { redirectUrl } = await response.json();
      window.location.href = redirectUrl;
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('error.title'),
        description: String(error),
      });
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect from integration
  const handleDisconnect = async () => {
    if (!integration) return;
    setIsLoading(true);
    try {
      const endpoint =
        integration.source === 'admin'
          ? `/api/integrations/${integration._id}/disconnect?sandbox=${isSandbox}`
          : `/api/clients/${integration._id}/disconnect?sandbox=${isSandbox}`;
      const response = await fetch(endpoint, { method: 'DELETE' });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || t('error.disconnect_failed'));
      }

      setIntegration((prev) => (prev ? { ...prev, connected: false, status: 'disconnected' } : null));
      toast({
        title: t('success.title'),
        description: t('success.disconnect_message'),
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('error.title'),
        description: String(error),
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Add webhook event
  const addWebhookEvent = (event: string) => {
    if (event && !webhookEvents.includes(event)) {
      setWebhookEvents([...webhookEvents, event]);
      form.setValue('webhook.events', [...webhookEvents, event]);
    }
  };

  // Add API endpoint field
  const addApiEndpointField = () => {
    setApiEndpointsFields([...apiEndpointsFields, { key: '', value: '' }]);
  };

  // Add credential field
  const addCredentialField = () => {
    setCredentialFields([...credentialFields, { key: '', value: '' }]);
  };

  if (isLoading || !integration) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600 dark:text-gray-400">{t('loading')}</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">{integration.providerName}</h1>
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="bg-gray-100 dark:bg-gray-800">
          <TabsTrigger value="overview">{t('overview')}</TabsTrigger>
          <TabsTrigger value="settings">{t('settings')}</TabsTrigger>
          <TabsTrigger value="stats">{t('stats')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle>{t('overview')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {integration.logoUrl && (
                <Image
                  src={integration.logoUrl}
                  alt={`${integration.providerName} Logo`}
                  width={150}
                  height={150}
                  className="mx-auto mb-4 rounded"
                />
              )}
              <p className="text-gray-600 dark:text-gray-300">{integration.description || t('no_description')}</p>
              {integration.categories && integration.categories.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {integration.categories.map((category, index) => (
                    <Badge key={index} variant="secondary" className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                      {t(category)}
                    </Badge>
                  ))}
                </div>
              )}
              {integration.rating && (
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
              )}
              {integration.installs && (
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                  {t('installs')}: {integration.installs}
                </p>
              )}
              {integration.images?.map((image, index) => (
                <Image
                  key={index}
                  src={image.url}
                  alt={`Integration Image ${index + 1}`}
                  width={image.size?.includes('px') ? parseInt(image.size) : 300}
                  height={image.size?.includes('px') ? parseInt(image.size) * 0.6 : 200}
                  style={{
                    margin: image.margin,
                    padding: image.padding,
                    position: image.customPosition?.position as any,
                    top: image.customPosition?.top,
                    left: image.customPosition?.left,
                  }}
                  className={`object-cover rounded ${image.position}`}
                />
              ))}
              {integration.videos?.map((video, index) => (
                <video
                  key={index}
                  src={video.url}
                  controls
                  style={{
                    width: video.size?.includes('px') ? video.size : '300px',
                    margin: video.margin,
                    padding: video.padding,
                    position: video.customPosition?.position as any,
                    top: video.customPosition?.top,
                    left: video.customPosition?.left,
                  }}
                  className={`rounded ${video.position}`}
                />
              ))}
              {integration.articles?.map((article, index) => (
                <div key={index} className="space-y-2">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{article.title}</h3>
                  <p className="text-gray-600 dark:text-gray-300">{article.content}</p>
                </div>
              ))}
              {integration.buttons?.map((button, index) => (
                <Button
                  key={index}
                  variant={button.type === 'primary' ? 'default' : button.type === 'secondary' ? 'outline' : 'link'}
                  style={{
                    backgroundColor: button.backgroundColor,
                    color: button.textColor,
                    borderRadius: button.borderRadius,
                    padding: button.padding,
                  }}
                  asChild
                >
                  <a href={button.link} target="_blank" rel="noopener noreferrer">
                    {button.label}
                  </a>
                </Button>
              ))}
              {integration.dividers?.map((divider, index) => (
                <hr key={index} style={{ border: divider.style }} className="my-4" />
              ))}
              <div className="flex items-center space-x-2">
                <Switch
                  checked={isSandbox}
                  onCheckedChange={setIsSandbox}
                  id="sandbox-mode"
                  className="data-[state=checked]:bg-blue-600"
                />
                <Label htmlFor="sandbox-mode" className="text-gray-700 dark:text-gray-300">
                  {t('sandbox_mode')}
                </Label>
              </div>
              {integration.connected ? (
                <Button
                  variant="destructive"
                  onClick={handleDisconnect}
                  disabled={isLoading}
                >
                  {t('disconnect')}
                </Button>
              ) : (
                <Button
                  onClick={handleConnect}
                  disabled={isConnecting}
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      {t('connecting')}
                    </>
                  ) : (
                    t('install')
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardHeader>
                  <CardTitle>{t('settings')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('description')}</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder={t('description_placeholder')}
                            className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="webhook.enabled"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2">
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            className="data-[state=checked]:bg-blue-600"
                          />
                        </FormControl>
                        <FormLabel>{t('enable_webhook')}</FormLabel>
                      </FormItem>
                    )}
                  />
                  {form.watch('webhook.enabled') && (
                    <>
                      <FormField
                        control={form.control}
                        name="webhook.url"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('webhook_url')}</FormLabel>
                            <FormControl>
                              <Input
                                placeholder={t('webhook_url_placeholder')}
                                className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="webhook.secret"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('webhook_secret')}</FormLabel>
                            <FormControl>
                              <Input
                                placeholder={t('webhook_secret_placeholder')}
                                type="password"
                                className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div>
                        <FormLabel>{t('webhook_events')}</FormLabel>
                        <div className="space-y-2">
                          <Input
                            placeholder={t('add_event')}
                            className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && e.currentTarget.value) {
                                addWebhookEvent(e.currentTarget.value);
                                e.currentTarget.value = '';
                              }
                            }}
                          />
                          {webhookEvents.map((event, index) => (
                            <div key={index} className="flex items-center space-x-2">
                              <Input
                                value={event}
                                disabled
                                className="bg-gray-100 dark:bg-gray-700"
                              />
                              <Button
                                type="button"
                                variant="destructive"
                                onClick={() => {
                                  const newEvents = webhookEvents.filter((_, i) => i !== index);
                                  setWebhookEvents(newEvents);
                                  form.setValue('webhook.events', newEvents);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                  {!integration.oauth?.enabled && (
                    <>
                      <div>
                        <FormLabel>{t('credentials')}</FormLabel>
                        {credentialFields.map((cred, index) => (
                          <div key={index} className="flex space-x-2 mb-3 items-center">
                            <Input
                              placeholder={t('credential_key')}
                              value={cred.key}
                              className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                              onChange={(e) => {
                                const newFields = [...credentialFields];
                                newFields[index].key = e.target.value;
                                setCredentialFields(newFields);
                                form.setValue(
                                  'credentials',
                                  newFields.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {})
                                );
                              }}
                            />
                            <Input
                              placeholder={t('credential_value')}
                              type="password"
                              value={cred.value}
                              className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                              onChange={(e) => {
                                const newFields = [...credentialFields];
                                newFields[index].value = e.target.value;
                                setCredentialFields(newFields);
                                form.setValue(
                                  'credentials',
                                  newFields.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {})
                                );
                              }}
                            />
                            <Button
                              type="button"
                              variant="destructive"
                              onClick={() => {
                                const newFields = credentialFields.filter((_, i) => i !== index);
                                setCredentialFields(newFields);
                                form.setValue(
                                  'credentials',
                                  newFields.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {})
                                );
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        <Button type="button" variant="outline" onClick={addCredentialField}>
                          <PlusCircle className="h-4 w-4 mr-2" />
                          {t('add_credential')}
                        </Button>
                      </div>
                    </>
                  )}
                  <div>
                    <FormLabel>{t('api_endpoints')}</FormLabel>
                    {apiEndpointsFields.map((endpoint, index) => (
                      <div key={index} className="flex space-x-2 mb-3 items-center">
                        <Input
                          placeholder={t('endpoint_key')}
                          value={endpoint.key}
                          className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                          onChange={(e) => {
                            const newFields = [...apiEndpointsFields];
                            newFields[index].key = e.target.value;
                            setApiEndpointsFields(newFields);
                            form.setValue(
                              'apiEndpoints',
                              newFields.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {})
                            );
                          }}
                        />
                        <Input
                          placeholder={t('endpoint_value')}
                          value={endpoint.value}
                          className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                          onChange={(e) => {
                            const newFields = [...apiEndpointsFields];
                            newFields[index].value = e.target.value;
                            setApiEndpointsFields(newFields);
                            form.setValue(
                              'apiEndpoints',
                              newFields.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {})
                            );
                          }}
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={() => {
                            const newFields = apiEndpointsFields.filter((_, i) => i !== index);
                            setApiEndpointsFields(newFields);
                            form.setValue(
                              'apiEndpoints',
                              newFields.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {})
                            );
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" onClick={addApiEndpointField}>
                      <PlusCircle className="h-4 w-4 mr-2" />
                      {t('add_endpoint')}
                    </Button>
                  </div>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        {t('saving')}
                      </>
                    ) : (
                      t('save_changes')
                    )}
                  </Button>
                </CardContent>
              </Card>
            </form>
          </Form>
        </TabsContent>

        <TabsContent value="stats">
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle>{t('stats')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">{t('inventory_stats')}</h3>
                {integration.inventoryStats ? (
                  <p className="text-gray-600 dark:text-gray-300">
                    {t('total_items')}: {integration.inventoryStats.totalItems} <br />
                    {t('last_synced')}: {new Date(integration.inventoryStats.lastSynced).toLocaleString()}
                  </p>
                ) : (
                  <p className="text-gray-600 dark:text-gray-300">{t('no_inventory_stats')}</p>
                )}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">{t('order_stats')}</h3>
                {integration.orderStats ? (
                  <p className="text-gray-600 dark:text-gray-300">
                    {t('total_orders')}: {integration.orderStats.totalOrders} <br />
                    {t('pending_orders')}: {integration.orderStats.pending} <br />
                    {t('last_synced')}: {new Date(integration.orderStats.lastSynced).toLocaleString()}
                  </p>
                ) : (
                  <p className="text-gray-600 dark:text-gray-300">{t('no_order_stats')}</p>
                )}
              </div>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    const endpoint =
                      integration.source === 'admin'
                        ? `/api/seller/integrations/${integration._id}/sync?sandbox=${isSandbox}`
                        : `/api/seller/developer-clients/${integration._id}/sync?sandbox=${isSandbox}`;
                    const response = await fetch(endpoint, {
                      method: 'POST',
                    });
                    if (!response.ok) throw new Error(t('error.sync_failed'));
                    toast({
                      title: t('success.title'),
                      description: t('success.sync_message'),
                    });
                  } catch (error) {
                    toast({
                      variant: 'destructive',
                      title: t('error.title'),
                      description: String(error),
                    });
                  }
                }}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                {t('sync_now')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}