'use client';

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Star, Loader2, Menu, X, Edit, Link } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { useSession } from 'next-auth/react';
import { USER_PERMISSIONS, SELLER_PERMISSIONS } from '@/lib/constants/permissions';

const availableCategories = [
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
] as const;

const appSchema = z.object({
  name: z.string().min(2, 'Application name must be at least 2 characters').max(100),
  redirectUris: z.array(z.string().url('Invalid redirect URI format')).min(1, 'At least one redirect URI is required'),
  scopes: z.array(z.string()).min(1, 'At least one scope is required'),
  description: z.string().max(500, 'Description cannot exceed 500 characters').optional(),
  logoUrl: z.string().url('Invalid logo URL format').optional().or(z.literal('')),
  videos: z
    .array(
      z.object({
        url: z.string().url('Invalid video URL'),
        position: z.enum(['left', 'center', 'right']).default('center'),
        size: z.enum(['small', 'medium', 'large']).default('medium'),
      })
    )
    .optional(),
  images: z
    .array(
      z.object({
        url: z.string().url('Invalid image URL'),
        position: z.enum(['left', 'center', 'right']).default('center'),
        size: z.enum(['small', 'medium', 'large']).default('medium'),
      })
    )
    .optional(),
  buttons: z
    .array(
      z.object({
        label: z.string().min(2, 'Button label must be at least 2 characters'),
        link: z.string().url('Invalid button link'),
        type: z.enum(['primary', 'secondary', 'link']).default('primary'),
      })
    )
    .optional(),
  features: z.array(z.string().max(200, 'Feature cannot exceed 200 characters')).optional(),
  categories: z.array(z.enum(availableCategories)).optional(),
  slug: z.string().regex(/^[a-z0-9-]+$/, 'Invalid slug format').optional(),
  pricing: z
    .object({
      model: z.enum(['free', 'one-time', 'subscription']).default('free'),
      amount: z.number().min(0, 'Price must be a positive number').optional(),
      currency: z.enum(['USD', 'SAR', 'EGP']).default('USD').optional(),
      interval: z.enum(['monthly', 'yearly']).optional(),
    })
    .refine(
      (data) => data.model === 'free' || (data.amount !== undefined && data.amount > 0),
      { message: 'Price is required for paid or subscription models', path: ['amount'] }
    )
    .refine(
      (data) => data.model !== 'subscription' || (data.interval !== undefined),
      { message: 'Interval is required for subscription model', path: ['interval'] }
    ),
});

type AppForm = z.infer<typeof appSchema>;

interface ClientApplication {
  _id: string;
  name: string;
  clientId: string;
  clientSecret: string;
  redirectUris: string[];
  scopes: string[];
  description?: string;
  logoUrl?: string;
  videos?: Array<{ url: string; position: 'left' | 'center' | 'right'; size: 'small' | 'medium' | 'large' }>;
  images?: Array<{ url: string; position: 'left' | 'center' | 'right'; size: 'small' | 'medium' | 'large' }>;
  buttons?: Array<{ label: string; link: string; type: 'primary' | 'secondary' | 'link' }>;
  features?: string[];
  categories?: string[];
  rating?: number;
  ratingsCount?: number;
  installs?: number;
  slug: string;
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected';
  pricing?: {
    model: 'free' | 'one-time' | 'subscription';
    amount?: number;
    currency?: 'USD' | 'SAR' | 'EGP';
    interval?: 'monthly' | 'yearly';
  };

}

export default function DeveloperAppsClient() {
  const t = useTranslations('Developer');
  const { toast } = useToast();
  const { data: session, status } = useSession();
  const [apps, setApps] = useState<ClientApplication[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState<'list' | 'create'>('list');

  const isSeller = session?.user?.role === 'SELLER';
  const availableScopes = isSeller ? SELLER_PERMISSIONS : USER_PERMISSIONS;

  const form = useForm<AppForm>({
    resolver: zodResolver(appSchema),
    defaultValues: {
      name: '',
      redirectUris: [''],
      scopes: ['profile:read'],
      description: '',
      logoUrl: '',
      videos: [],
      images: [],
      buttons: [],
      features: [],
      categories: [],
      slug: '',
    },
  });

  const { fields: videoFields, append: appendVideo, remove: removeVideo } = useFieldArray({
    control: form.control,
    name: 'videos',
  });

  const { fields: imageFields, append: appendImage, remove: removeImage } = useFieldArray({
    control: form.control,
    name: 'images',
  });

  const { fields: buttonFields, append: appendButton, remove: removeButton } = useFieldArray({
    control: form.control,
    name: 'buttons',
  });

  const { fields: featureFields, append: appendFeature, remove: removeFeature } = useFieldArray({
    control: form.control,
    name: 'features' as any, // مؤقتًا لتجنب الخطأ
  });

  const fetchApps = async () => {
    if (status === 'loading' || !session?.user?.id) {
      setLoading(true);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/v1/clients', {
        headers: {
          Authorization: `Bearer ${session.user.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || t('errors.failedToFetchApps'));
      }

      const { data } = await response.json();
      setApps(data?.clients || []);
    } catch (err: any) {
      setError(err.message || t('errors.unknown'));
      toast({
        variant: 'destructive',
        title: t('errors.failedToFetchApps'),
        description: err.message || t('errors.unknown'),
      });
    } finally {
      setLoading(false);
    }
  };

  const createApp = async (data: AppForm) => {
    if (!session?.user?.id) {
      toast({
        variant: 'destructive',
        title: t('errors.unauthorized'),
        description: t('errors.pleaseSignIn'),
      });
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/v1/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.user.token}`,
        },
        body: JSON.stringify({
          ...data,
          isMarketplaceApp: true, // Always true for DeveloperAppsClient
          status: 'pending', // Marketplace apps start as pending
          pricing: data.pricing, // إضافة بيانات التسعيرة
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || t('errors.failedToCreateApp'));
      }

      form.reset();
      await fetchApps();
      toast({
        title: t('messages.appCreatedPending'),
        description: t('messages.appCreatedPending'),
      });
      setActiveView('list');
    } catch (err: any) {
      setError(err.message || t('errors.unknown'));
      toast({
        variant: 'destructive',
        title: t('errors.failedToCreateApp'),
        description: err.message || t('errors.unknown'),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApps();
  }, [session, status]);

  if (status === 'loading') {
    return (
      <div className="text-center py-12 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600 dark:text-gray-400">{t('loading')}</span>
      </div>
    );
  }

  if (!session?.user?.id) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{t('errors.pleaseSignIn')}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transform transition-transform duration-300',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0 lg:static lg:inset-0'
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('developerApplications')}</h2>
          <Button
            variant="ghost"
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <nav className="p-4 space-y-2">
          <Button
            variant={activeView === 'list' ? 'default' : 'ghost'}
            className="w-full justify-start"
            onClick={() => {
              setActiveView('list');
              setSidebarOpen(false);
            }}
          >
            {t('listApps')}
          </Button>
          <Button
            variant={activeView === 'create' ? 'default' : 'ghost'}
            className="w-full justify-start"
            onClick={() => {
              setActiveView('create');
              setSidebarOpen(false);
            }}
          >
            {t('createNewApp')}
          </Button>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6">
        <Button
          variant="ghost"
          className="lg:hidden mb-4"
          onClick={() => setSidebarOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </Button>

        {error && (
          <div className="mb-6">
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        )}

        {activeView === 'create' && (
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle>{t('createNewApp')}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={form.handleSubmit(createApp)} className="space-y-6">
                <div>
                  <Label htmlFor="name">{t('appName')}</Label>
                  <Input
                    id="name"
                    {...form.register('name')}
                    placeholder={t('appNamePlaceholder')}
                    className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                  />
                  {form.formState.errors.name && (
                    <p className="text-red-500 text-sm">{form.formState.errors.name.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="slug">{t('slug')}</Label>
                  <Input
                    id="slug"
                    {...form.register('slug')}
                    placeholder={t('slugPlaceholder')}
                    className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                  />
                  {form.formState.errors.slug && (
                    <p className="text-red-500 text-sm">{form.formState.errors.slug.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="redirectUris">{t('redirectUri')}</Label>
                  <Input
                    id="redirectUris"
                    {...form.register('redirectUris.0')}
                    placeholder={t('redirectUriPlaceholder')}
                    className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                  />
                  {form.formState.errors.redirectUris && (
                    <p className="text-red-500 text-sm">{form.formState.errors.redirectUris.message}</p>
                  )}
                </div>

                <div>
                  <Label>{t('scopes')}</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2 max-h-48 overflow-y-auto p-2 border rounded-md bg-gray-50 dark:bg-gray-900">
                    {availableScopes.map((scope) => (
                      <div key={scope} className="flex items-center space-x-2 p-1 rounded">
                        <Checkbox
                          id={scope}
                          checked={form.watch('scopes')?.includes(scope) || false}
                          onCheckedChange={(checked) => {
                            const newScopes = checked
                              ? [...(form.watch('scopes') || []), scope]
                              : (form.watch('scopes') || []).filter((s) => s !== scope);
                            form.setValue('scopes', newScopes);
                          }}
                          disabled={loading}
                        />
                        <Label htmlFor={scope} className="text-sm cursor-pointer flex-1">
                          {scope}
                        </Label>
                      </div>
                    ))}
                  </div>
                  {form.formState.errors.scopes && (
                    <p className="text-red-500 text-sm">{form.formState.errors.scopes.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="description">{t('description')}</Label>
                  <Textarea
                    id="description"
                    {...form.register('description')}
                    placeholder={t('descriptionPlaceholder')}
                    className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                  />
                  {form.formState.errors.description && (
                    <p className="text-red-500 text-sm">{form.formState.errors.description.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="logoUrl">{t('logoUrl')}</Label>
                  <Input
                    id="logoUrl"
                    {...form.register('logoUrl')}
                    placeholder={t('logoUrlPlaceholder')}
                    className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                  />
                  {form.formState.errors.logoUrl && (
                    <p className="text-red-500 text-sm">{form.formState.errors.logoUrl.message}</p>
                  )}
                </div>

                <div>
                  <Label>{t('images')}</Label>
                  {imageFields.map((field, index) => (
                    <div key={field.id} className="flex gap-2 mt-2">
                      <Input
                        {...form.register(`images.${index}.url`)}
                        placeholder={t('imageUrlPlaceholder')}
                        className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                      />
                      <Select
                        onValueChange={(value) => form.setValue(`images.${index}.position`, value as any)}
                        defaultValue={field.position}
                      >
                        <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                          <SelectValue placeholder={t('selectPosition')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="left">{t('left')}</SelectItem>
                          <SelectItem value="center">{t('center')}</SelectItem>
                          <SelectItem value="right">{t('right')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select
                        onValueChange={(value) => form.setValue(`images.${index}.size`, value as any)}
                        defaultValue={field.size}
                      >
                        <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                          <SelectValue placeholder={t('selectSize')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="small">{t('small')}</SelectItem>
                          <SelectItem value="medium">{t('medium')}</SelectItem>
                          <SelectItem value="large">{t('large')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="destructive" onClick={() => removeImage(index)}>
                        {t('remove')}
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => appendImage({ url: '', position: 'center', size: 'medium' })}
                    className="mt-2"
                  >
                    {t('addImage')}
                  </Button>
                  {form.formState.errors.images && (
                    <p className="text-red-500 text-sm">{form.formState.errors.images.message}</p>
                  )}
                </div>

                <div>
                  <Label>{t('videos')}</Label>
                  {videoFields.map((field, index) => (
                    <div key={field.id} className="flex gap-2 mt-2">
                      <Input
                        {...form.register(`videos.${index}.url`)}
                        placeholder={t('videoUrlPlaceholder')}
                        className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                      />
                      <Select
                        onValueChange={(value) => form.setValue(`videos.${index}.position`, value as any)}
                        defaultValue={field.position}
                      >
                        <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                          <SelectValue placeholder={t('selectPosition')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="left">{t('left')}</SelectItem>
                          <SelectItem value="center">{t('center')}</SelectItem>
                          <SelectItem value="right">{t('right')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select
                        onValueChange={(value) => form.setValue(`videos.${index}.size`, value as any)}
                        defaultValue={field.size}
                      >
                        <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                          <SelectValue placeholder={t('selectSize')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="small">{t('small')}</SelectItem>
                          <SelectItem value="medium">{t('medium')}</SelectItem>
                          <SelectItem value="large">{t('large')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="destructive" onClick={() => removeVideo(index)}>
                        {t('remove')}
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => appendVideo({ url: '', position: 'center', size: 'medium' })}
                    className="mt-2"
                  >
                    {t('addVideo')}
                  </Button>
                  {form.formState.errors.videos && (
                    <p className="text-red-500 text-sm">{form.formState.errors.videos.message}</p>
                  )}
                </div>

                <div>
                  <Label>{t('buttons')}</Label>
                  {buttonFields.map((field, index) => (
                    <div key={field.id} className="flex gap-2 mt-2">
                      <Input
                        {...form.register(`buttons.${index}.label`)}
                        placeholder={t('buttonLabelPlaceholder')}
                        className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                      />
                      <Input
                        {...form.register(`buttons.${index}.link`)}
                        placeholder={t('buttonLinkPlaceholder')}
                        className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                      />
                      <Select
                        onValueChange={(value) => form.setValue(`buttons.${index}.type`, value as any)}
                        defaultValue={field.type}
                      >
                        <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                          <SelectValue placeholder={t('selectButtonType')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="primary">{t('primary')}</SelectItem>
                          <SelectItem value="secondary">{t('secondary')}</SelectItem>
                          <SelectItem value="link">{t('link')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="destructive" onClick={() => removeButton(index)}>
                        {t('remove')}
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => appendButton({ label: '', link: '', type: 'primary' })}
                    className="mt-2"
                  >
                    {t('addButton')}
                  </Button>
                  {form.formState.errors.buttons && (
                    <p className="text-red-500 text-sm">{form.formState.errors.buttons.message}</p>
                  )}
                </div>

                <div>
                  <Label>{t('features')}</Label>
                  {featureFields.map((field, index) => (
                    <div key={field.id} className="flex gap-2 mt-2">
                      <Input
                        {...form.register(`features.${index}`)}
                        placeholder={t('featurePlaceholder')}
                        className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                      />
                      <Button type="button" variant="destructive" onClick={() => removeFeature(index)}>
                        {t('remove')}
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => appendFeature('')}
                    className="mt-2"
                  >
                    {t('addFeature')}
                  </Button>
                  {form.formState.errors.features && (
                    <p className="text-red-500 text-sm">{form.formState.errors.features.message}</p>
                  )}
                </div>

                <div>
                  <Label>{t('categories')}</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2 max-h-48 overflow-y-auto p-2 border rounded-md bg-gray-50 dark:bg-gray-900">
                    {availableCategories.map((category) => (
                      <div key={category} className="flex items-center space-x-2 p-1 rounded">
                        <Checkbox
                          id={category}
                          checked={form.watch('categories')?.includes(category) || false}
                          onCheckedChange={(checked) => {
                            const newCategories = checked
                              ? [...(form.watch('categories') || []), category]
                              : (form.watch('categories') || []).filter((c) => c !== category);
                            form.setValue('categories', newCategories);
                          }}
                          disabled={loading}
                        />
                        <Label htmlFor={category} className="text-sm cursor-pointer flex-1">
                          {t(category)}
                        </Label>
                      </div>
                    ))}
                  </div>
                  {form.formState.errors.categories && (
                    <p className="text-red-500 text-sm">{form.formState.errors.categories.message}</p>
                  )}
                </div>
                <div>
                  <Label>{t('pricing')}</Label>
                  <div className="space-y-4 mt-2">
                    <Select
                      onValueChange={(value) => form.setValue('pricing.model', value as any)}
                      defaultValue={form.watch('pricing.model') || 'free'}
                    >
                      <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                        <SelectValue placeholder={t('selectPricingModel')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">{t('free')}</SelectItem>
                        <SelectItem value="one-time">{t('oneTime')}</SelectItem>
                        <SelectItem value="subscription">{t('subscription')}</SelectItem>
                      </SelectContent>
                    </Select>

                    {form.watch('pricing.model') !== 'free' && (
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <Label htmlFor="pricing.amount">{t('amount')}</Label>
                          <Input
                            id="pricing.amount"
                            type="number"
                            {...form.register('pricing.amount', { valueAsNumber: true })}
                            placeholder={t('amountPlaceholder')}
                            className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                          />
                          {form.formState.errors.pricing?.amount && (
                            <p className="text-red-500 text-sm">{form.formState.errors.pricing.amount.message}</p>
                          )}
                        </div>
                        <div className="w-1/3">
                          <Label htmlFor="pricing.currency">{t('currency')}</Label>
                          <Select
                            onValueChange={(value) => form.setValue('pricing.currency', value as any)}
                            defaultValue={form.watch('pricing.currency') || 'USD'}
                          >
                            <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                              <SelectValue placeholder={t('selectCurrency')} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="USD">USD</SelectItem>
                              <SelectItem value="SAR">SAR</SelectItem>
                              <SelectItem value="EGP">EGP</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

                    {form.watch('pricing.model') === 'subscription' && (
                      <div>
                        <Label htmlFor="pricing.interval">{t('interval')}</Label>
                        <Select
                          onValueChange={(value) => form.setValue('pricing.interval', value as any)}
                          defaultValue={form.watch('pricing.interval')}
                        >
                          <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                            <SelectValue placeholder={t('selectInterval')} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="monthly">{t('monthly')}</SelectItem>
                            <SelectItem value="yearly">{t('yearly')}</SelectItem>
                          </SelectContent>
                        </Select>
                        {form.formState.errors.pricing?.interval && (
                          <p className="text-red-500 text-sm">{form.formState.errors.pricing.interval.message}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      {t('creating')}
                    </>
                  ) : (
                    t('createApp')
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {activeView === 'list' && (
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle>{t('yourApps')}</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-12 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  <span className="ml-2 text-gray-600 dark:text-gray-400">{t('loading')}</span>
                </div>
              ) : apps.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <p className="text-gray-600 dark:text-gray-400 mb-2">{t('noAppsFound')}</p>
                  <p className="text-sm text-gray-500">{t('createFirstApp')}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                  {apps.map((app) => (
                    <Card key={app._id} className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                      <CardContent className="p-6">
                        <div className="flex justify-between items-start mb-4">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{app.name}</h3>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {t('status')}: {t(app.status)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">{app.description || t('noDescription')}</p>
                        {app.logoUrl ? (
                          <img src={app.logoUrl} alt={app.name} className="w-16 h-16 object-contain mb-2" />
                        ) : (
                          <img src="/icons/logo.svg" alt="Default Logo" className="w-16 h-16 object-contain mb-2" />
                        )}
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                          {t('slug')}: <a href={`/integrations/${app.slug}`} className="text-blue-600 dark:text-blue-400 hover:underline">{app.slug}</a>
                        </p>
                        {app.features && app.features.length > 0 && (
                          <div className="mb-2">
                            <span className="font-medium text-gray-700 dark:text-gray-300">{t('features')}:</span>
                            <ul className="list-disc pl-5">
                              {app.features.map((feature, index) => (
                                <li key={index} className="text-sm text-gray-600 dark:text-gray-300">{feature}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {app.categories && app.categories.length > 0 && (
                          <div className="mb-2">
                            <span className="font-medium text-gray-700 dark:text-gray-300">{t('categories')}:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {app.categories.map((category, index) => (
                                <span
                                  key={index}
                                  className="inline-block bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-full text-xs"
                                >
                                  {t(category)}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {app.rating && (
                          <div className="mb-2 flex items-center">
                            <span className="font-medium text-gray-700 dark:text-gray-300">{t('rating')}:</span>
                            <div className="flex ml-2">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className={`h-4 w-4 ${i < Math.round(app.rating!) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
                                />
                              ))}
                              <span className="ml-2 text-sm text-gray-600 dark:text-gray-300">
                                ({app.ratingsCount} {t('reviews')})
                              </span>
                            </div>
                          </div>
                        )}
                        {app.installs && (
                          <div className="mb-2">
                            <span className="font-medium text-gray-700 dark:text-gray-300">{t('installs')}:</span>
                            <span className="ml-2 text-sm text-gray-600 dark:text-gray-300">{app.installs}</span>
                          </div>
                        )}

{activeView === 'list' && (
  <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
    <CardHeader>
      <CardTitle>{t('yourApps')}</CardTitle>
    </CardHeader>
    <CardContent>
      {loading ? (
        <div className="text-center py-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600 dark:text-gray-400">{t('loading')}</span>
        </div>
      ) : apps.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <p className="text-gray-600 dark:text-gray-400 mb-2">{t('noAppsFound')}</p>
          <p className="text-sm text-gray-500">{t('createFirstApp')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {apps.map((app) => (
            <Card key={app._id} className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{app.name}</h3>
                  <div className="flex gap-2">
                    <Button variant="outline" asChild className="flex items-center gap-2">
                      <Link href={`/integrations/${app.slug}/edit`}>
                        <Edit className="h-4 w-4" />
                        {t('editApp')}
                      </Link>
                    </Button>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {t('status')}: {t(app.status)}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">{app.description || t('noDescription')}</p>
                {app.logoUrl ? (
                  <img src={app.logoUrl} alt={app.name} className="w-16 h-16 object-contain mb-2" />
                ) : (
                  <img src="/icons/logo.svg" alt="Default Logo" className="w-16 h-16 object-contain mb-2" />
                )}
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                  {t('slug')}: <a href={`/integrations/${app.slug}`} className="text-blue-600 dark:text-blue-400 hover:underline">{app.slug}</a>
                </p>
                {app.features && app.features.length > 0 && (
                  <div className="mb-2">
                    <span className="font-medium text-gray-700 dark:text-gray-300">{t('features')}:</span>
                    <ul className="list-disc pl-5">
                      {app.features.map((feature, index) => (
                        <li key={index} className="text-sm text-gray-600 dark:text-gray-300">{feature}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {app.categories && app.categories.length > 0 && (
                  <div className="mb-2">
                    <span className="font-medium text-gray-700 dark:text-gray-300">{t('categories')}:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {app.categories.map((category, index) => (
                        <span
                          key={index}
                          className="inline-block bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-full text-xs"
                        >
                          {t(category)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {app.rating && (
                  <div className="mb-2 flex items-center">
                    <span className="font-medium text-gray-700 dark:text-gray-300">{t('rating')}:</span>
                    <div className="flex ml-2">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${i < Math.round(app.rating!) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
                        />
                      ))}
                      <span className="ml-2 text-sm text-gray-600 dark:text-gray-300">
                        ({app.ratingsCount} {t('reviews')})
                      </span>
                    </div>
                  </div>
                )}
                {app.installs && (
                  <div className="mb-2">
                    <span className="font-medium text-gray-700 dark:text-gray-300">{t('installs')}:</span>
                    <span className="ml-2 text-sm text-gray-600 dark:text-gray-300">{app.installs}</span>
                  </div>
                )}
                {app.pricing && (
                  <div className="mb-2">
                    <span className="font-medium text-gray-700 dark:text-gray-300">{t('pricing')}:</span>
                    <span className="ml-2 text-sm text-gray-600 dark:text-gray-300">
                      {app.pricing.model === 'free'
                        ? t('free')
                        : `${app.pricing.amount} ${app.pricing.currency} ${
                            app.pricing.model === 'subscription' ? `/${t(app.pricing.interval)}` : ''
                          }`}
                    </span>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">Client ID:</span>
                    <div className="font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs break-all">
                      {app.clientId}
                    </div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">Client Secret:</span>
                    <div className="font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs break-all">
                      {app.clientSecret}
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <span className="font-medium text-gray-700 dark:text-gray-300">Redirect URIs:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {app.redirectUris.map((uri, index) => (
                        <span
                          key={index}
                          className="inline-block bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-full text-xs"
                        >
                          {uri}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <span className="font-medium text-gray-700 dark:text-gray-300">Scopes:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {app.scopes.map((scope, index) => (
                        <span
                          key={index}
                          className="inline-block bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded-full text-xs"
                        >
                          {scope}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </CardContent>
  </Card>
)}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-medium text-gray-700 dark:text-gray-300">Client ID:</span>
                            <div className="font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs break-all">
                              {app.clientId}
                            </div>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700 dark:text-gray-300">Client Secret:</span>
                            <div className="font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs break-all">
                              {app.clientSecret}
                            </div>
                          </div>
                          <div className="md:col-span-2">
                            <span className="font-medium text-gray-700 dark:text-gray-300">Redirect URIs:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {app.redirectUris.map((uri, index) => (
                                <span
                                  key={index}
                                  className="inline-block bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-full text-xs"
                                >
                                  {uri}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="md:col-span-2">
                            <span className="font-medium text-gray-700 dark:text-gray-300">Scopes:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {app.scopes.map((scope, index) => (
                                <span
                                  key={index}
                                  className="inline-block bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded-full text-xs"
                                >
                                  {scope}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}