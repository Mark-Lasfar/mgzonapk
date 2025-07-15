'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useForm, FormProvider, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Trash2, RefreshCw, Eye, Edit, Search } from 'lucide-react';
import Link from 'next/link';
import Sidebar from '@/components/ui/Sidebar';
import { IIntegration } from '@/lib/db/models/integration.model';
// import { logger } from '@/lib/utils';
import { SellerError } from '@/lib/errors/seller-error';
import { ProductImportService } from '@/lib/api/services/product-import';
import { logger } from '@/lib/utils/logger';

interface AdCampaign {
  _id: string;
  providerName: string;
  name: string;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'failed';
  budget: { amount: number; currency: string };
  schedule: { startDate: string; endDate?: string };
  metrics: { impressions: number; clicks: number; conversions: number; spend: number };
  targeting?: Record<string, any>;
  creatives: { type: 'image' | 'video' | 'text'; url: string; metadata?: Record<string, any> }[];
  products?: string[];
}

interface Notification {
  _id: string;
  message: string;
  read: boolean;
  createdAt: string;
}

interface Product {
  _id: string;
  name: string;
  currency: string;
  availability: 'in_stock' | 'out_of_stock';
}

const campaignSchema = z.object({
  integrationId: z.string().min(1, 'Ads.Error.Integration Required'),
  name: z.string().min(1, 'Ads.Error.Name Required'),
  budget: z.object({
    amount: z.number().positive('Ads.Error.Budget Positive'),
    currency: z.string().min(1, 'Ads.Error.Currency Required'),
  }),
  schedule: z.object({
    startDate: z.string().refine(
      (val) => {
        const date = new Date(val);
        return !isNaN(Date.parse(val)) && date >= new Date();
      },
      'Ads.Error.Invalid Start Date'
    ),
    endDate: z.string().optional(),
  }),
  targeting: z.record(z.any()).optional(),
  creatives: z
    .array(
      z.object({
        type: z.enum(['image', 'video', 'text']),
        url: z.string().url('Ads.Error.Invalid Url'),
        metadata: z.record(z.any()).optional(),
      })
    )
    .min(1, 'Ads.Error.Creatives Required'),
  products: z.array(z.string()).optional(),
});

type CampaignForm = z.infer<typeof campaignSchema>;

const CreativeInput = ({
  index,
  removeCreative,
  control,
  t,
}: {
  index: number;
  removeCreative: (index: number) => void;
  control: any;
  t: any;
}) => {
  return (
    <div className="flex space-x-2 mb-3 items-center">
      <FormField
        control={control}
        name={`creatives.${index}.type`}
        render={({ field }) => (
          <FormItem>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="image">{t('Image')}</SelectItem>
                <SelectItem value="video">{t('Video')}</SelectItem>
                <SelectItem value="text">{t('Text')}</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name={`creatives.${index}.url`}
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <Input placeholder={t('Creative Url Placeholder')} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <Button type="button" variant="destructive" onClick={() => removeCreative(index)}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default function SellerAdsPage() {
  const t = useTranslations('Ads');
  const router = useRouter();
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [integrations, setIntegrations] = useState<IIntegration[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sandbox, setSandbox] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 10;
  const productImportService = new ProductImportService();

  const form = useForm<CampaignForm>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      integrationId: '',
      name: '',
      budget: { amount: 0, currency: 'USD' },
      schedule: { startDate: new Date().toISOString() },
      creatives: [{ type: 'image', url: '' }],
      products: [],
    },
  });

  const { fields: creatives, append, remove } = useFieldArray({
    control: form.control,
    name: 'creatives',
  });

  const { fields: productFields, append: appendProduct, remove: removeProduct } = useFieldArray({
    control: form.control,
    name: 'products',
  });

  useEffect(() => {
    const abortController = new AbortController();
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [campaignsRes, integrationsRes, notificationsRes, productsRes] = await Promise.all([
          fetch(
            `/api/seller/ads?sandbox=${sandbox}&status=${filterStatus !== 'all' ? filterStatus : ''}&search=${searchQuery}&page=${page}&limit=${limit}`,
            { signal: abortController.signal }
          ),
          fetch(`/api/seller/integrations?sandbox=${sandbox}`, { signal: abortController.signal }),
          fetch(`/api/seller/notifications?limit=5`, { signal: abortController.signal }),
          fetch(`/api/seller/products?sandbox=${sandbox}&limit=50`, { signal: abortController.signal }),
        ]);

        if (!campaignsRes.ok || !integrationsRes.ok || !notificationsRes.ok || !productsRes.ok) {
          const errorData = await (
            campaignsRes.ok
              ? integrationsRes.ok
                ? notificationsRes.ok
                  ? productsRes
                  : notificationsRes
                : integrationsRes
              : campaignsRes
          ).json();
          throw new SellerError('FETCH_FAILED', errorData.message || t('Error.Message'));
        }

        const { data: campaignsData, totalPages: campaignsTotalPages } = await campaignsRes.json();
        const { data: integrationsData } = await integrationsRes.json();
        const { data: notificationsData } = await notificationsRes.json();
        const { data: productsData } = await productsRes.json();

        setCampaigns(Array.isArray(campaignsData) ? campaignsData : []);
        setTotalPages(campaignsTotalPages || 1);
        setIntegrations(
          Array.isArray(integrationsData)
            ? integrationsData.filter((int: IIntegration) => int.connected && ['advertising', 'dropshipping'].includes(int.type))
            : []
        );
        setNotifications(Array.isArray(notificationsData) ? notificationsData : []);
        setProducts(
          Array.isArray(productsData)
            ? productsData.map((p: any) => ({
                _id: p._id,
                name: p.title,
                currency: p.currency,
                availability: p.availability,
              }))
            : []
        );

        logger.info('Fetched ads page data', {
          campaigns: campaignsData.length,
          integrations: integrationsData.length,
          products: productsData.length,
        });
      } catch (error: any) {
        if (error.name === 'AbortError') return;
        logger.error('Error fetching ads page data', { error });
        toast({
          variant: 'destructive',
          title: t('Error.Title'),
          description: error instanceof SellerError ? error.message : t('Error.Message'),
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
    return () => abortController.abort();
  }, [sandbox, filterStatus, searchQuery, page, t]);

  const addCreative = () => {
    append({ type: 'image', url: '' });
  };

  const handleImportProduct = async (integrationId: string, productId: string, region: string = 'global') => {
    try {
      const sellerId = (await (await fetch('/api/seller/profile')).json()).data._id;
      const product = await productImportService.importProduct(integrationId, productId, sellerId, region);
      setProducts([...products, { _id: product._id, name: product.title, currency: product.currency, availability: product.availability }]);
      appendProduct(product._id);
      toast({ title: t('Success.Title'), description: t('Success.ProductImported') });
      logger.info('Product imported successfully', { productId: product._id, sellerId, integrationId });
    } catch (error: any) {
      logger.error('Error importing product', { error, integrationId, productId });
      toast({
        variant: 'destructive',
        title: t('Error.Title'),
        description: error instanceof SellerError ? error.message : t('Error.Message'),
      });
    }
  };

  const onSubmit = async (data: CampaignForm) => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/seller/ads?sandbox=${sandbox}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new SellerError('CREATE_CAMPAIGN_FAILED', errorData.message || t('Error.Message'));
      }

      const { data: newCampaign } = await response.json();
      setCampaigns([...campaigns, newCampaign]);
      toast({ title: t('Success.Title'), description: t('Success.Created') });
      form.reset();
      logger.info('Ad campaign created', { campaignId: newCampaign._id });
    } catch (error: any) {
      logger.error('Error creating ad campaign', { error });
      toast({
        variant: 'destructive',
        title: t('Error.Title'),
        description: error instanceof SellerError ? error.message : t('Error.Message'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSyncMetrics = async (campaignId: string) => {
    setIsSyncing(campaignId);
    try {
      const response = await fetch(`/api/seller/ads/sync?campaignId=${campaignId}&sandbox=${sandbox}`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new SellerError('SYNC_METRICS_FAILED', errorData.message || t('Error.Message'));
      }

      const { data } = await response.json();
      setCampaigns(campaigns.map((c) => (c._id === campaignId ? { ...c, metrics: data.metrics } : c)));
      toast({ title: t('Success.Title'), description: t('Success.Metrics Synced') });
      logger.info('Ad campaign metrics synced', { campaignId });
    } catch (error: any) {
      logger.error('Error syncing ad campaign metrics', { error, campaignId });
      toast({
        variant: 'destructive',
        title: t('Error.Title'),
        description: error instanceof SellerError ? error.message : t('Error.Message'),
      });
    } finally {
      setIsSyncing(null);
    }
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    try {
      const response = await fetch(`/api/seller/ads?campaignId=${campaignId}&sandbox=${sandbox}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new SellerError('DELETE_CAMPAIGN_FAILED', errorData.message || t('Error.Message'));
      }

      setCampaigns(campaigns.filter((c) => c._id !== campaignId));
      toast({ title: t('Success.Title'), description: t('Success.Deleted') });
      logger.info('Ad campaign deleted', { campaignId });
    } catch (error: any) {
      logger.error('Error deleting ad campaign', { error, campaignId });
      toast({
        variant: 'destructive',
        title: t('Error.Title'),
        description: error instanceof SellerError ? error.message : t('Error.Message'),
      });
    }
  };

  return (
    <div className="flex">
      <Sidebar notifications={notifications} />
      <div className="flex-1 container mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">{t('Title')}</h1>
        <div className="flex justify-between mb-6 gap-4">
          <Input
            placeholder={t('Search Placeholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-sm"
          />
          <Select onValueChange={setFilterStatus} defaultValue="all">
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t('Filter Status')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('All')}</SelectItem>
              <SelectItem value="draft">{t('Draft')}</SelectItem>
              <SelectItem value="active">{t('Active')}</SelectItem>
              <SelectItem value="paused">{t('Paused')}</SelectItem>
              <SelectItem value="completed">{t('Completed')}</SelectItem>
              <SelectItem value="failed">{t('Failed')}</SelectItem>
            </SelectContent>
          </Select>
          <Select onValueChange={(value) => setSandbox(value === 'true')}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t('Environment')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="false">{t('Live')}</SelectItem>
              <SelectItem value="true">{t('Sandbox')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t('Create Campaign')}</CardTitle>
          </CardHeader>
          <CardContent>
            {integrations.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-gray-500">{t('No Integrations Available')}</p>
                <Link href="/seller/dashboard/integrations">
                  <Button variant="outline" className="mt-4">
                    {t('Setup Integrations')}
                  </Button>
                </Link>
              </div>
            ) : (
              <FormProvider {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="integrationId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Integration')}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('Select Integration')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {integrations.map((int) => (
                              <SelectItem key={int._id} value={int._id.toString()}>
                                {int.providerName} {int.description ? `(${int.description})` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Name')}</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder={t('Name Placeholder')} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="budget.amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Budget')}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            placeholder={t('Budget Placeholder')}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="budget.currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Currency')}</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder={t('Currency Placeholder')} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="schedule.startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Start Date')}</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="schedule.endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('End Date')}</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div>
                    <FormLabel>{t('Products')}</FormLabel>
                    {productFields.map((product, index) => (
                      <div key={product.id} className="flex space-x-2 mb-3 items-center">
                        <FormField
                          control={form.control}
                          name={`products.${index}`}
                          render={({ field }) => (
                            <FormItem>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {products.map((p) => (
                                    <SelectItem key={p._id} value={p._id}>
                                      {p.name} ({p.currency}, {p.availability})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button type="button" variant="destructive" onClick={() => removeProduct(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => appendProduct('')}
                      disabled={isSubmitting}
                    >
                      <PlusCircle className="h-4 w-4 mr-2" /> {t('Add Product')}
                    </Button>
                    <div className="mt-2">
                      <FormLabel>{t('Import Product')}</FormLabel>
                      <div className="flex space-x-2">
                        <Input
                          placeholder={t('Product ID')}
                          id="productId"
                        />
                        <Select id="region" defaultValue="global">
                          <SelectTrigger>
                            <SelectValue placeholder={t('Region')} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="global">{t('Global')}</SelectItem>
                            <SelectItem value="na">{t('North America')}</SelectItem>
                            <SelectItem value="eu">{t('Europe')}</SelectItem>
                            <SelectItem value="arabic">{t('Arabic')}</SelectItem>
                            <SelectItem value="fe">{t('Far East')}</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          onClick={async () => {
                            const productId = (document.getElementById('productId') as HTMLInputElement).value;
                            const region = (document.getElementById('region') as HTMLSelectElement).value;
                            const integrationId = form.getValues('integrationId');
                            if (integrationId && productId) {
                              await handleImportProduct(integrationId, productId, region);
                            } else {
                              toast({
                                variant: 'destructive',
                                title: t('Error.Title'),
                                description: t('Error.Missing Integration or Product ID'),
                              });
                            }
                          }}
                          disabled={isSubmitting}
                        >
                          {t('Import')}
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div>
                    <FormLabel>{t('Creatives')}</FormLabel>
                    {creatives.map((creative, index) => (
                      <CreativeInput
                        key={creative.id}
                        index={index}
                        removeCreative={remove}
                        control={form.control}
                        t={t}
                      />
                    ))}
                    <Button type="button" variant="outline" onClick={addCreative} disabled={isSubmitting}>
                      <PlusCircle className="h-4 w-4 mr-2" /> {t('Add Creative')}
                    </Button>
                  </div>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? t('Loading') : t('Create')}
                  </Button>
                </form>
              </FormProvider>
            )}
          </CardContent>
        </Card>
        {isLoading ? (
          <p>{t('Loading')}</p>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>{t('Campaigns')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('Name')}</TableHead>
                    <TableHead>{t('Provider')}</TableHead>
                    <TableHead>{t('Status')}</TableHead>
                    <TableHead>{t('Budget')}</TableHead>
                    <TableHead>{t('Impressions')}</TableHead>
                    <TableHead>{t('Clicks')}</TableHead>
                    <TableHead>{t('Products')}</TableHead>
                    <TableHead>{t('Actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((campaign) => (
                    <TableRow key={campaign._id}>
                      <TableCell>{campaign.name}</TableCell>
                      <TableCell>{campaign.providerName}</TableCell>
                      <TableCell>{t(campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1))}</TableCell>
                      <TableCell>{`${campaign.budget.amount} ${campaign.budget.currency}`}</TableCell>
                      <TableCell>{campaign.metrics.impressions}</TableCell>
                      <TableCell>{campaign.metrics.clicks}</TableCell>
                      <TableCell>{campaign.products?.length || 0}</TableCell>
                      <TableCell className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => router.push(`/seller/dashboard/ads/${campaign._id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => router.push(`/seller/dashboard/ads/${campaign._id}/edit`)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="icon">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t('Delete Campaign')}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {t('Delete Confirmation', { name: campaign.name })}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteCampaign(campaign._id)}>
                                {t('Delete')}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleSyncMetrics(campaign._id)}
                          disabled={isSyncing === campaign._id}
                        >
                          <RefreshCw className={`h-4 w-4 ${isSyncing === campaign._id ? 'animate-spin' : ''}`} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex justify-between mt-4">
                <Button disabled={page === 1} onClick={() => setPage(page - 1)}>
                  {t('Previous')}
                </Button>
                <span>{t('Page', { current: page, total: totalPages })}</span>
                <Button disabled={page === totalPages} onClick={() => setPage(page + 1)}>
                  {t('Next')}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}