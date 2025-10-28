'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useForm, FormProvider, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation } from '@apollo/client/react';
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
import { PlusCircle, Trash2, RefreshCw, Eye, Edit, Search } from 'lucide-react';
import Link from 'next/link';
import Sidebar from '@/components/ui/Sidebar';
import { CreativeInput } from './CreativeInput';
import { GET_SELLER_DATA } from '@/graphql/seller/queries';
import { CREATE_CAMPAIGN, SYNC_CAMPAIGN_METRICS, DELETE_CAMPAIGN } from '@/graphql/ads/mutations';
import { useToast } from '@/components/ui/toast';
import { useCampaigns, useSyncCampaignMetrics } from '@/lib/hooks/useCampaigns';
import { useDebounce } from 'use-debounce';

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
  targeting: z.record(z.string(), z.any()).optional(),
  creatives: z
    .array(
      z.object({
        type: z.enum(['image', 'video', 'text']),
        url: z.string().url('Ads.Error.Invalid Url'),
        metadata: z.record(z.string(), z.any()).optional(),
      })
    )
    .min(1, 'Ads.Error.Creatives Required'),
  products: z.array(z.string()).optional(),
  region: z.string().optional(), // Added region to the schema
});

type CampaignForm = z.infer<typeof campaignSchema>;

interface Creative {
  type: 'image' | 'video' | 'text';
  url: string;
  metadata?: Record<string, any>;
}

interface Budget {
  amount: number;
  currency: string;
}

interface Schedule {
  startDate: string;
  endDate?: string;
}

interface Metrics {
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
}

interface AdCampaign {
  _id: string;
  providerName: string;
  name: string;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'failed';
  budget: Budget;
  schedule: Schedule;
  metrics: Metrics;
  targeting?: Record<string, any>;
  creatives: Creative[];
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

interface Integration {
  id: string;
  providerName: string;
  description?: string;
}

interface SellerData {
  integrations: Integration[];
  products: Product[];
  notifications: Notification[];
}

interface SellerDataQuery {
  sellerData: SellerData;
}

export default function AdsList() {
  const t = useTranslations('Ads');
  const router = useRouter();
  const { toast } = useToast();
  const [sandbox, setSandbox] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery] = useDebounce(searchQuery, 500);
  const [filterStatus, setFilterStatus] = useState('all');
  const [page, setPage] = useState(1);
  const limit = 10;

  const sellerId = 'SELLER_ID'; // Replace with actual sellerId from auth context
  const { data, loading: isLoading } = useCampaigns(sellerId, sandbox, filterStatus, debouncedSearchQuery, page, limit);
  const campaigns = data?.campaigns || [];
  const totalPages = data?.totalPages || 1;
  const { handleSync, isSyncing } = useSyncCampaignMetrics();

  const form = useForm<CampaignForm>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      integrationId: '',
      name: '',
      budget: { amount: 0, currency: 'USD' },
      schedule: { startDate: new Date().toISOString() },
      creatives: [{ type: 'image', url: '' }],
      products: [],
      region: 'global',
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

  const { data: sellerData, loading: sellerDataLoading } = useQuery<SellerDataQuery>(GET_SELLER_DATA, {
    variables: { sellerId, sandboxMode: sandbox, notificationLimit: 5 },
  });

  const [createCampaign] = useMutation(CREATE_CAMPAIGN);
  const [deleteCampaign] = useMutation(DELETE_CAMPAIGN);

  const handleImportProduct = async (integrationId: string, productId: string, region: string = 'global') => {
    try {
      const response = await fetch(`/api/seller/products/import?integrationId=${integrationId}&productId=${productId}&region=${region}`, {
        method: 'POST',
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || t('Error.Message'));
      }
      const product = await response.json();
      appendProduct(product._id);
      toast({ title: t('Success.Title'), description: t('Success.ProductImported') });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: t('Error.Title'),
        description: error.message || t('Error.Message'),
      });
    }
  };

  const onSubmit = async (data: CampaignForm) => {
    try {
      const { data: newCampaign } = await createCampaign({
        variables: { input: { ...data, sellerId } },
      });
      toast({ title: t('Success.Title'), description: t('Success.Created') });
      form.reset();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: t('Error.Title'),
        description: error.message || t('Error.Message'),
      });
    }
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    try {
      await deleteCampaign({
        variables: { campaignId, sandbox },
      });
      toast({ title: t('Success.Title'), description: t('Success.Deleted') });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: t('Error.Title'),
        description: error.message || t('Error.Message'),
      });
    }
  };

  return (
    <div className="flex">
      <Sidebar notifications={sellerData?.sellerData.notifications || []} />
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
            {sellerData?.sellerData.integrations.length === 0 ? (
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
                            {sellerData?.sellerData.integrations.map((int) => (
                              <SelectItem key={int.id} value={int.id}>
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
                                  {sellerData?.sellerData.products.map((p) => (
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
                      disabled={form.formState.isSubmitting}
                    >
                      <PlusCircle className="h-4 w-4 mr-2" /> {t('Add Product')}
                    </Button>
                    <div className="mt-2">
                      <FormLabel>{t('Import Product')}</FormLabel>
                      <div className="flex space-x-2">
                        <Input placeholder={t('Product ID')} id="productId" />
                        <FormField
                          control={form.control}
                          name="region"
                          render={({ field }) => (
                            <FormItem>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder={t('Region')} />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="global">{t('Global')}</SelectItem>
                                  <SelectItem value="na">{t('North America')}</SelectItem>
                                  <SelectItem value="eu">{t('Europe')}</SelectItem>
                                  <SelectItem value="arabic">{t('Arabic')}</SelectItem>
                                  <SelectItem value="fe">{t('Far East')}</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button
                          type="button"
                          onClick={async () => {
                            const productId = (document.getElementById('productId') as HTMLInputElement).value;
                            const region = form.getValues('region') || 'global';
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
                          disabled={form.formState.isSubmitting}
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
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => append({ type: 'image', url: '' })}
                      disabled={form.formState.isSubmitting}
                    >
                      <PlusCircle className="h-4 w-4 mr-2" /> {t('Add Creative')}
                    </Button>
                  </div>
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? t('Loading') : t('Create')}
                  </Button>
                </form>
              </FormProvider>
            )}
          </CardContent>
        </Card>
        {isLoading || sellerDataLoading ? (
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
                    campaign && ( // Ensure campaign is not undefined
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
                            onClick={() => handleSync(campaign._id, sandbox)}
                            disabled={isSyncing === campaign._id}
                          >
                            <RefreshCw className={`h-4 w-4 ${isSyncing === campaign._id ? 'animate-spin' : ''}`} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
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