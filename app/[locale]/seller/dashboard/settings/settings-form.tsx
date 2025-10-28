// /home/mark/Music/my-nextjs-project-clean/app/[locale]/(root)/seller/dashboard/settings/settings-form.tsx
'use client';

import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Upload, Eye, EyeOff, Trash2 } from 'lucide-react';
import { SettingsFormData, SettingsFormDataSchema, TemplateFormData } from '@/lib/types/settings';
import z from 'zod';
import SellerAccountSettingsPage from './account/page';
import FinancialProfilePage from './financial-profile/page';
import SellerNotificationsSettingsPage from './notifications/page';
import SecuritySettings from './security/page';
import TemplateSettingsFormWrapper from '@/components/seller/TemplateSettingsFormWrapper';
import SellerCustomSiteFormWrapper from '@/components/seller/SellerCustomSiteFormWrapper';
import DomainManager from '@/components/seller/DomainManager';
import IntegrationsManager from '@/components/seller/IntegrationsManager';
import SitePreview from '@/components/seller/SitePreview';
import TemplateEditor from '@/components/seller/TemplateEditor';
import SellerDeliveryDateForm from './delivery-dates/page';
import SellerPaymentMethodForm from './payment-methods/page';
import PageManager from '@/components/seller/PageManager';
import MessagesManager from '@/components/seller/MessagesManager';

// File size and type limits
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ACCEPTED_DOCUMENT_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];

// Schema for form validation with preprocess for File objects
const settingsFormSchema = (t: any) =>
  SettingsFormDataSchema.extend({
    customSite: z
      .object({
        theme: z.string().default('default'),
        primaryColor: z.string().regex(/^#([0-9A-F]{3}){1,2}$/i, {
          message: t('Invalid color format'),
        }),
        logo: z.preprocess(
          (val) => (val instanceof File ? val : undefined),
          z.instanceof(File).optional().refine((file) => !file || file.size <= MAX_FILE_SIZE, {
            message: t('errors.fileSizeDescription', { size: '5MB' }),
          }).refine((file) => !file || ACCEPTED_IMAGE_TYPES.includes(file.type), {
            message: t('errors.fileTypeDescription'),
          })
        ),
        bannerImage: z.preprocess(
          (val) => (val instanceof File ? val : undefined),
          z.instanceof(File).optional().refine((file) => !file || file.size <= MAX_FILE_SIZE, {
            message: t('errors.fileSizeDescription', { size: '5MB' }),
          }).refine((file) => !file || ACCEPTED_IMAGE_TYPES.includes(file.type), {
            message: t('errors.fileTypeDescription'),
          })
        ),
        customSections: z
          .array(
            z.object({
              title: z.string().min(2, { message: t('Section title must be at least 2 characters') }),
              slug: z.string().min(1, { message: t('Section slug is required') }),
              content: z.string().min(10, { message: t('Section content must be at least 10 characters') }),
              type: z.enum([
                'custom', 'hero', 'products', 'testimonials', 'faq', 'footer', 'contact-form', 'countdown',
                'text', 'image', 'video', 'button', 'heading', 'divider', 'spacer',
                'carousel', 'slider', 'gallery', 'columns', 'features-grid', 'pricing-table', 'cta', 'accordion', 'tabs', 'testimonial-carousel', 'logos', 'timeline', 'steps', 'animation', 'count-up',
                'popup', 'newsletter', 'map',
                'product-card', 'collection-banner', 'upsell', 'related-products', 'quick-view', 'carousel-products', 'reviews',
                'breadcrumbs', 'navigation', 'sidebar', 'blog-posts', 'article', 'background-video', 'icon-grid', 'image-grid', 'shape-divider', 'chat',
              ], {
                message: t('Invalid section type'),
              }),
              position: z.number().optional(),
            })
          )
          .optional(),
        domainStatus: z.enum(['active', 'expired', 'pending']).optional(),
        seo: z
          .object({
            metaTitle: z.string().max(60, { message: t('Meta title must be 60 characters or less') }).optional(),
            metaDescription: z.string().max(160, { message: t('Meta description must be 160 characters or less') }).optional(),
            keywords: z.array(z.string()).optional(),
          })
          .optional(),
        customDomain: z.string().url({ message: t('Invalid URL format') }).optional(),
      })
      .optional(),
    verification: z
      .object({
        documents: z
          .array(
            z.object({
              url: z.preprocess(
                (val) => (val instanceof File ? val : undefined),
                z.instanceof(File).optional().refine((file) => !file || file.size <= MAX_FILE_SIZE, {
                  message: t('errors.fileSizeDescription', { size: '5MB' }),
                }).refine((file) => !file || ACCEPTED_DOCUMENT_TYPES.includes(file.type), {
                  message: t('errors.fileTypeDescription'),
                })
              ),
              type: z.enum(['id', 'business_license', 'tax_document', 'other']),
              status: z.enum(['pending', 'verified', 'rejected']).default('pending'),
              uploadedAt: z.coerce.date().optional(),
              metadata: z.record(z.string(), z.any()).optional(),
            })
          )
          .optional(),
        status: z.enum(['pending', 'verified', 'rejected']).optional(),
        submittedAt: z.coerce.date().optional(),
        lastUpdatedAt: z.coerce.date().optional(),
      })
      .optional(),
  }).refine(
    (data) => {
      if (data.discountOffers) {
        return data.discountOffers.every((offer) => {
          if (offer.validUntil && offer.validFrom) {
            return new Date(offer.validUntil) > new Date(offer.validFrom);
          }
          return true;
        });
      }
      return true;
    },
    {
      message: t('validation.discountOffers.validDates'),
      path: ['discountOffers'],
    }
  );

type SettingsFormValues = z.infer<ReturnType<typeof settingsFormSchema>>;

interface SellerSettingsFormProps {
  seller: SettingsFormData & {
    logo: string;
    settings?: {
      notifications?: {
        email: boolean;
        sms: boolean;
        push: boolean;
        orderUpdates: boolean;
        marketingEmails: boolean;
        pointsNotifications: boolean;
      };
      display?: {
        showRating: boolean;
        showContactInfo: boolean;
        showMetrics: boolean;
        showPointsBalance: boolean;
        welcomeSeen: boolean;
      };
      security?: {
        twoFactorAuth: boolean;
        loginNotifications: boolean;
      };
      customSite?: {
        theme: string;
        primaryColor: string;
        bannerImage?: string;
        customSections?: Array<{ title: string; content: string; position?: number }>;
        seo?: { metaTitle: string; metaDescription: string; keywords: string[] };
        domainStatus?: 'active' | 'expired' | 'pending';
        customDomain?: string;
      };
      defaultPaymentGateway?: string;
    };
    verification?: {
      documents?: Array<{
        url?: string | File;
        type: 'id' | 'business_license' | 'tax_document' | 'other';
        status: 'pending' | 'verified' | 'rejected';
        uploadedAt?: Date;
        metadata?: Record<string, any>;
      }>;
      status?: 'pending' | 'verified' | 'rejected';
      submittedAt?: Date;
      lastUpdatedAt?: Date;
    };
    freeTrialActive?: boolean;
    freeTrialEndDate?: string | Date;
    pointsBalance?: number;
    subscription: {
      plan: 'Trial' | 'Basic' | 'Pro' | 'VIP';
      status?: 'active' | 'inactive' | 'pending';
    };
    storeId: string;
    userId: string;
  };
  locale: string;
}

export default function SellerSettingsForm({ seller, locale }: SellerSettingsFormProps) {
  const t = useTranslations('SellerSettings');
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [showBankInfo, setShowBankInfo] = useState(false);
  const [hasMgpay, setHasMgpay] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(seller.logo || null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(
    seller.settings?.customSite?.bannerImage || null
  );
  const [pointsBalance, setPointsBalance] = useState(seller.pointsBalance || 0);
  const [trialDaysRemaining, setTrialDaysRemaining] = useState(0);
  const [availablePaymentProviders, setAvailablePaymentProviders] = useState<
    Array<{ providerName: string }>
  >([]);
  const [availableShippingProviders, setAvailableShippingProviders] = useState<
    Array<{ providerName: string }>
  >([]);
  const [previewData, setPreviewData] = useState<SettingsFormData>(seller);

  // Initialize form
  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema(t)),
    defaultValues: {
      businessName: seller.businessName || '',
      description: seller.description || '',
      email: seller.email || '',
      phone: seller.phone || '',
      customSiteUrl: seller.customSiteUrl || '',
      address: {
        street: seller.address?.street || '',
        city: seller.address?.city || '',
        state: seller.address?.state || '',
        postalCode: seller.address?.postalCode || '',
        countryCode: seller.address?.countryCode || '',
      },
      bankInfo: {
        accountName: seller.bankInfo?.accountName || '',
        accountNumber: '',
        bankName: seller.bankInfo?.bankName || '',
        swiftCode: seller.bankInfo?.swiftCode || '',
        verified: seller.bankInfo?.verified || false,
      },
      notifications: {
        email: seller.settings?.notifications?.email ?? true,
        sms: seller.settings?.notifications?.sms ?? false,
        push: seller.settings?.notifications?.push ?? false,
        orderUpdates: seller.settings?.notifications?.orderUpdates ?? true,
        marketingEmails: seller.settings?.notifications?.marketingEmails ?? false,
        pointsNotifications: seller.settings?.notifications?.pointsNotifications ?? true,
      },
      display: {
        showRating: seller.settings?.display?.showRating ?? true,
        showContactInfo: seller.settings?.display?.showContactInfo ?? true,
        showMetrics: seller.settings?.display?.showMetrics ?? true,
        showPointsBalance: seller.settings?.display?.showPointsBalance ?? true,
        welcomeSeen: seller.settings?.display?.welcomeSeen ?? false,
      },
      security: {
        twoFactorAuth: seller.settings?.security?.twoFactorAuth ?? false,
        loginNotifications: seller.settings?.security?.loginNotifications ?? true,
      },
      customSite: {
        theme: seller.settings?.customSite?.theme ?? 'default',
        primaryColor: seller.settings?.customSite?.primaryColor ?? '#000000',
        logo: undefined,
        bannerImage: undefined,
        customSections: seller.settings?.customSite?.customSections ?? [],
        seo: seller.settings?.customSite?.seo ?? { metaTitle: '', metaDescription: '', keywords: [] },
        domainStatus: seller.settings?.customSite?.domainStatus ?? 'pending',
        customDomain: seller.settings?.customSite?.customDomain ?? '',
      },
      template: {
        layout: seller.template?.layout || [],
        colors: seller.template?.colors || { primary: '#ff6600', secondary: '#333' },
        heroConfig: seller.template?.heroConfig || { title: '', subtitle: '' },
        assets: seller.template?.assets || [],
      },
      shippingOptions: seller.shippingOptions || [],
      discountOffers: seller.discountOffers || [],
      paymentGateways: seller.paymentGateways || [],
      taxSettings: seller.taxSettings || {},
      domains: seller.domains || [],
      verification: seller.verification || { documents: [], status: 'pending' },
      defaultPaymentGateway: seller.settings?.defaultPaymentGateway || '',
    },
    mode: 'onChange',
  });

  const { fields: shippingFields, append: appendShipping, remove: removeShipping } = useFieldArray({
    control: form.control,
    name: 'shippingOptions',
  });
  const { fields: discountFields, append: appendDiscount, remove: removeDiscount } = useFieldArray({
    control: form.control,
    name: 'discountOffers',
  });
  const { fields: domainFields, append: appendDomain, remove: removeDomain } = useFieldArray({
    control: form.control,
    name: 'domains',
  });

  // Update preview data when form changes
  useEffect(() => {
    const subscription = form.watch((value) => {
      setPreviewData(value as SettingsFormData);
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // Fetch integrations
  useEffect(() => {
    const fetchPaymentIntegrations = async () => {
      try {
        const res = await fetch('/api/seller/integrations?type=payment');
        const data = await res.json();
        if (data.success) {
          setAvailablePaymentProviders(
            data.data
              .filter((int: any) => int.type === 'payment' && int.status === 'connected')
              .map((int: any) => ({ providerName: int.providerName }))
          );
        }
      } catch (err) {
        toast({
          title: t('errors.fetchFailed'),
          description: t('errors.fetchFailed'),
          variant: 'destructive',
        });
      }
    };

    const fetchShippingIntegrations = async () => {
      try {
        const res = await fetch('/api/seller/integrations?type=shipping');

        const data = await res.json();
        if (data.success) {
          setAvailableShippingProviders(
            data.data
              .filter((int: any) => int.type === 'shipping' && int.status === 'connected')
              .map((int: any) => ({ providerName: int.providerName }))
          );
        }
      } catch (err) {
        toast({
          title: t('errors.fetchFailed'),
          description: t('errors.fetchFailed'),
          variant: 'destructive',
        });
      }
    };

    fetchPaymentIntegrations();
    fetchShippingIntegrations();
  }, [t, toast]);

  // Update hasMgpay dynamically
  useEffect(() => {
    setHasMgpay(availablePaymentProviders.some((provider) => provider.providerName === 'mgpay'));
  }, [availablePaymentProviders]);

  // Fetch settings
  useEffect(() => {
    async function fetchSettings() {
      try {
        const response = await fetch('/api/seller/settings');
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message || t('errors.fetchDescription'));
        }
        const sellerData = result.data;
        form.reset({
          ...sellerData,
          bankInfo: {
            ...sellerData.bankInfo,
            accountNumber: '',
          },
          customSite: {
            ...sellerData.settings?.customSite,
            logo: undefined,
            bannerImage: undefined,
          },
          taxSettings: sellerData.taxSettings || {},
          domains: sellerData.domains || [],
          verification: sellerData.verification || { documents: [], status: 'pending' },
        });
        setPointsBalance(sellerData.pointsBalance || 0);
        setLogoPreview(sellerData.logo || null);
        setBannerPreview(sellerData.settings?.customSite?.bannerImage || null);
        setPreviewData(sellerData);
        if (sellerData.freeTrialActive && sellerData.freeTrialEndDate) {
          const now = new Date();
          const endDate = new Date(sellerData.freeTrialEndDate);
          const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
          setTrialDaysRemaining(daysRemaining > 0 ? daysRemaining : 0);
        }
      } catch (error) {
        toast({
          title: t('errors.fetchTitle'),
          description: error instanceof Error ? error.message : t('errors.fetchDescription'),
          variant: 'destructive',
        });
        router.push('/login');
      } finally {
        setIsFetching(false);
      }
    }
    fetchSettings();
  }, [form, toast, t, router]);

  // Poll for points balance
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/seller/settings');
        const result = await response.json();
        if (result.success && result.data) {
          setPointsBalance(result.data.pointsBalance || 0);
        }
      } catch (error) {
        console.error('Failed to fetch points balance:', error);
      }
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Handle image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'banner') => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: t('errors.fileSizeTitle'),
          description: t('errors.fileSizeDescription', { size: '5MB' }),
          variant: 'destructive',
        });
        return;
      }
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        toast({
          title: t('errors.fileTypeTitle'),
          description: t('errors.fileTypeDescription'),
          variant: 'destructive',
        });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (type === 'logo') {
          setLogoPreview(reader.result as string);
        } else {
          setBannerPreview(reader.result as string);
        }
      };
      reader.onerror = () => {
        toast({
          title: t('errors.fileReadTitle'),
          description: t('errors.fileReadDescription'),
          variant: 'destructive',
        });
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast({
        title: t('errors.uploadTitle'),
        description: t('errors.uploadDescription'),
        variant: 'destructive',
      });
    }
  };

  // Handle form submission
  const handleSubmit = async (data: SettingsFormValues) => {
    setIsLoading(true);
    try {
      const formData = new FormData();
      const settings = {
        ...data,
        bankInfo: hasMgpay && showBankInfo && data.bankInfo?.accountNumber ? {
          ...data.bankInfo,
          accountNumber: data.bankInfo.accountNumber,
          swiftCode: data.bankInfo.swiftCode,
        } : undefined,
        customSite: {
          ...data.customSite,
          logo: undefined,
          bannerImage: undefined,
        },
        template: data.template,
      };
      formData.append('settings', JSON.stringify(settings));
      if (data.customSite?.logo instanceof File) {
        formData.append('logo', data.customSite.logo);
      }
      if (data.customSite?.bannerImage instanceof File) {
        formData.append('bannerImage', data.customSite.bannerImage);
      }
      if (data.verification?.documents) {
        data.verification.documents.forEach((doc, index) => {
          if (doc.url instanceof File) {
            formData.append(`documents[${index}]`, doc.url);
          }
        });
      }

      // Save to /api/seller/settings
      const sellerResponse = await fetch('/api/seller/settings', {
        method: 'PATCH',
        body: formData,
      });
      const sellerResult = await sellerResponse.json();
      if (!sellerResponse.ok || !sellerResult.success) {
        throw new Error(sellerResult.message || t('errors.submitDescription'));
      }

      // Save template and custom site to /api/stores/${storeId}/settings
      if (seller.storeId && (data.template || data.customSite)) {
        const storeFormData = new FormData();
        storeFormData.append('settings', JSON.stringify({ customSite: data.customSite, template: data.template }));
        if (data.customSite?.logo instanceof File) {
          storeFormData.append('logo', data.customSite.logo);
        }
        if (data.customSite?.bannerImage instanceof File) {
          storeFormData.append('bannerImage', data.customSite.bannerImage);
        }
        const storeResponse = await fetch(`/api/stores/${seller.storeId}/settings`, {
          method: 'PATCH',
          body: storeFormData,
        });
        if (!storeResponse.ok) {
          throw new Error(t('errors.saveError'));
        }
      }

      toast({
        title: t('success.title'),
        description: t('success.description'),
      });
      form.reset(data);
      setPreviewData(data);
    } catch (error) {
      toast({
        title: t('errors.submitTitle'),
        description: error instanceof Error ? error.message : t('errors.submitDescription'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle subscription upgrade
  const handleUpgradeSubscription = async (plan: 'Basic' | 'Pro' | 'VIP') => {
    try {
      const response = await fetch('/api/seller/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, pointsToRedeem: 0 }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || t('errors.submitDescription'));
      }
      toast({
        title: t('success.title'),
        description: t('success.subscriptionUpgraded', { plan }),
      });
      router.refresh();
    } catch (error) {
      toast({
        title: t('errors.submitTitle'),
        description: error instanceof Error ? error.message : t('errors.submitDescription'),
        variant: 'destructive',
      });
    }
  };

  if (isFetching) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 flex gap-6">
      <div className="w-2/3">
        <Card className="max-w-4xl">
          <CardHeader>
            <CardTitle>{t('title')}</CardTitle>
            {seller.freeTrialActive && (
              <div className="mt-4 p-4 bg-blue-100 rounded-lg">
                <p className="text-sm font-semibold">{t('trialStatus', { days: trialDaysRemaining })}</p>
                <p className="text-sm">{t('trialDescription')}</p>
                <Button
                  variant="link"
                  onClick={() => router.push('/seller/dashboard/subscriptions')}
                  className="mt-2 p-0 h-auto"
                >
                  {t('upgradePlan')}
                </Button>
              </div>
            )}
            <div className="mt-4 p-4 bg-green-100 rounded-lg">
              <p className="text-sm font-semibold">{t('pointsBalance', { points: pointsBalance })}</p>
              <p className="text-sm">{t('pointsDescription')}</p>
            </div>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
                <Tabs defaultValue="businessInfo" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    <TabsTrigger value="businessInfo">{t('sections.businessInfo')}</TabsTrigger>
                    <TabsTrigger value="address">{t('sections.address')}</TabsTrigger>
                    {hasMgpay && <TabsTrigger value="bankInfo">{t('sections.bankInfo')}</TabsTrigger>}
                    <TabsTrigger value="account">{t('sections.account')}</TabsTrigger>
                    <TabsTrigger value="subscription">{t('sections.subscription')}</TabsTrigger>
                    <TabsTrigger value="discounts">{t('sections.discountOffers')}</TabsTrigger>
                    <TabsTrigger value="notifications">{t('sections.notifications')}</TabsTrigger>
                    <TabsTrigger value="display">{t('sections.display')}</TabsTrigger>
                    <TabsTrigger value="security">{t('sections.security')}</TabsTrigger>
                    <TabsTrigger value="customSite">{t('sections.customSite')}</TabsTrigger>
                    <TabsTrigger value="taxes">{t('sections.taxes')}</TabsTrigger>
                    <TabsTrigger value="domains">{t('sections.domains')}</TabsTrigger>
                    <TabsTrigger value="domainstb">{t('sections.domains')}</TabsTrigger>
                    <TabsTrigger value="verification">{t('sections.verification')}</TabsTrigger>
                    <TabsTrigger value="integrations">{t('sections.integrations')}</TabsTrigger>
                    <TabsTrigger value="paymentMethods">{t('sections.paymentMethods')}</TabsTrigger>
                    <TabsTrigger value="deliveryDates">{t('sections.shippingOptions')}</TabsTrigger>
                    <TabsTrigger value="template">{t('sections.template')}</TabsTrigger>
                    <TabsTrigger value="templateeditor">{t('sections.templateeditor')}</TabsTrigger>
                    <TabsTrigger value="managePages">{t('sections.managePages')}</TabsTrigger>
                    <TabsTrigger value="integrationsmanager">{t('sections.integrationsmanager')}</TabsTrigger>
                    <TabsTrigger value="messages">{t('sections.messages')}</TabsTrigger>
                  </TabsList>
                  {/* Business Info Tab */}
                  <TabsContent value="businessInfo" id="businessInfo">
                    <Card>
                      <CardHeader>
                        <CardTitle>{t('sections.businessInfo')}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <FormField
                          control={form.control}
                          name="businessName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('businessName.label')}</FormLabel>
                              <FormControl>
                                <Input placeholder={t('businessName.placeholder')} {...field} />
                              </FormControl>
                              <FormDescription>{t('businessName.description')}</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('email.label')}</FormLabel>
                              <FormControl>
                                <Input placeholder={t('email.placeholder')} {...field} />
                              </FormControl>
                              <FormDescription>{t('email.description')}</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('description.label')}</FormLabel>
                              <FormControl>
                                <Textarea placeholder={t('description.placeholder')} className="h-32" {...field} />
                              </FormControl>
                              <FormDescription>{t('description.description')}</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('phone.label')}</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder={t('phone.placeholder')}
                                  {...field}
                                  onChange={(e) => {
                                    const value = e.target.value.replace(/[^\d+()-\s]/g, '');
                                    field.onChange(value);
                                  }}
                                />
                              </FormControl>
                              <FormDescription>{t('phone.description')}</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="customSiteUrl"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('customSiteUrl.label')}</FormLabel>
                              <FormControl>
                                <Input placeholder={t('customSiteUrl.placeholder')} {...field} />
                              </FormControl>
                              <FormDescription>{t('customSiteUrl.description')}</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>
                  {/* Address Tab */}
                  <TabsContent value="address" id="address">
                    <Card>
                      <CardHeader>
                        <CardTitle>{t('sections.address')}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="address.street"
                            render={({ field }) => (
                              <FormItem className="md:col-span-2">
                                <FormLabel>{t('address.street.label')}</FormLabel>
                                <FormControl>
                                  <Input placeholder={t('address.street.placeholder')} {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="address.city"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('address.city.label')}</FormLabel>
                                <FormControl>
                                  <Input placeholder={t('address.city.placeholder')} {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="address.state"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('address.state.label')}</FormLabel>
                                <FormControl>
                                  <Input placeholder={t('address.state.placeholder')} {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="address.postalCode"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('address.postalCode.label')}</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder={t('address.postalCode.placeholder')}
                                    {...field}
                                    onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="address.countryCode"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('address.countryCode.label')}</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder={t('address.countryCode.placeholder')}
                                    {...field}
                                    onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                  {/* Bank Info Tab */}
                  {hasMgpay && (
                    <TabsContent value="bankInfo">
                      <Card>
                        <CardHeader>
                          <CardTitle>{t('sections.bankInfo')}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowBankInfo(!showBankInfo)}
                            className="mb-4"
                          >
                            {showBankInfo ? (
                              <>
                                <EyeOff className="mr-2 h-4 w-4" />
                                {t('hideBankInfo')}
                              </>
                            ) : (
                              <>
                                <Eye className="mr-2 h-4 w-4" />
                                {t('showBankInfo')}
                              </>
                            )}
                          </Button>
                          {showBankInfo && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <FormField
                                control={form.control}
                                name="bankInfo.accountName"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>{t('bankInfo.accountName.label')}</FormLabel>
                                    <FormControl>
                                      <Input placeholder={t('bankInfo.accountName.placeholder')} {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="bankInfo.accountNumber"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>{t('bankInfo.accountNumber.label')}</FormLabel>
                                    <FormControl>
                                      <Input placeholder={t('bankInfo.accountNumber.placeholder')} {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="bankInfo.bankName"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>{t('bankInfo.bankName.label')}</FormLabel>
                                    <FormControl>
                                      <Input placeholder={t('bankInfo.bankName.placeholder')} {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="bankInfo.swiftCode"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>{t('bankInfo.swiftCode.label')}</FormLabel>
                                    <FormControl>
                                      <Input
                                        placeholder={t('bankInfo.swiftCode.placeholder')}
                                        {...field}
                                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                                      />
                                    </FormControl>
                                    <FormDescription>{t('bankInfo.swiftCode.description')}</FormDescription>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </TabsContent>
                  )}
                  {/* Account Tab */}
                  <TabsContent value="account" id="account">
                    <Card>
                      <CardHeader>
                        <CardTitle>{t('sections.account')}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <SellerAccountSettingsPage locale={locale} />
                      </CardContent>
                    </Card>
                  </TabsContent>
                  {/* Financial Profile Tab */}
                  <TabsContent value="financial-profile" id="financial-profile">
                    <Card>
                      <CardHeader>
                        <CardTitle>{t('sections.financial-profile')}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <FinancialProfilePage locale={locale} />
                      </CardContent>
                    </Card>
                  </TabsContent>
                  {/* Notifications Tab */}
                  <TabsContent value="notifications" id="notifications">
                    <Card>
                      <CardHeader>
                        <CardTitle>{t('sections.notifications')}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <SellerNotificationsSettingsPage locale={locale} />
                      </CardContent>
                    </Card>
                  </TabsContent>
                  {/* Security Tab */}
                  <TabsContent value="security" id="security">
                    <Card>
                      <CardHeader>
                        <CardTitle>{t('sections.security')}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <SecuritySettings userId={seller.userId} form={form} locale={locale} seller={''} />
                      </CardContent>
                    </Card>
                  </TabsContent>
                  {/* Template Tab */}
                  <TabsContent value="template" id="template">
                    <Card>
                      <CardHeader>
                        <CardTitle>{t('sections.template')}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <TemplateSettingsFormWrapper
                          defaultValues={{
                            layout: seller.template?.layout || [],
                            colors: seller.template?.colors || { primary: '#ff6600', secondary: '#333' },
                            heroConfig: seller.template?.heroConfig || { title: '', subtitle: '' },
                            assets: seller.template?.assets || [],
                          }}
                          locale={locale}
                          storeId={seller.storeId}
                          onChange={(templateData: TemplateFormData) => {
                            form.setValue('template', templateData);
                            setPreviewData({ ...previewData, template: templateData });
                          }}
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>
                  {/* Template Editor Tab */}
                  <TabsContent value="templateeditor" id="templateeditor">
                    <Card>
                      <CardHeader>
                        <CardTitle>{t('sections.templateeditor')}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <TemplateEditor
                          defaultValues={{
                            layout: seller.template?.layout || [],
                            colors: seller.template?.colors || { primary: '#ff6600', secondary: '#333' },
                            heroConfig: seller.template?.heroConfig || { title: '', subtitle: '' },
                            assets: seller.template?.assets || [],
                          }}
                          locale={locale}
                          storeId={seller.storeId}
                          onChange={(templateData: TemplateFormData) => {
                            form.setValue('template', templateData);
                            setPreviewData({ ...previewData, template: templateData });
                          }}
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>
                  {/* Custom Site Tab */}
                  <TabsContent value="customSite" id="customSite">
                    <Card>
                      <CardHeader>
                        <CardTitle>{t('sections.customSite')}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <SellerCustomSiteFormWrapper
                          defaultValues={form.getValues()}
                          locale={locale}
                          storeId={seller.storeId}
                          onChange={(customSiteData: SettingsFormData['customSite']) => {
                            form.setValue('customSite', customSiteData);
                            setPreviewData({ ...previewData, customSite: customSiteData });
                          }}
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>
                  {/* Domains Tab */}
                  <TabsContent value="domains" id="domains">
                    <Card>
                      <CardHeader>
                        <CardTitle>{t('sections.domains')}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <DomainManager storeId={seller.storeId} />
                      </CardContent>
                    </Card>
                  </TabsContent>
                  {/* Integrations Manager Tab */}
                  <TabsContent value="integrationsmanager" id="integrationsmanager">
                    <Card>
                      <CardHeader>
                        <CardTitle>{t('sections.integrationsmanager')}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <IntegrationsManager storeId={seller.storeId} />
                      </CardContent>
                    </Card>
                  </TabsContent>
                  {/* Subscription Tab */}
                  <TabsContent value="subscription" id="subscription">
                    <Card>
                      <CardHeader>
                        <CardTitle>{t('sections.subscription')}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <FormField
                          control={form.control}
                          name="subscription.plan"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('subscription.plan.label')}</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={seller.subscription.plan || 'Trial'}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder={t('subscription.plan.placeholder')} />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="Trial">{t('subscription.plan.trial')}</SelectItem>
                                  <SelectItem value="Basic">{t('subscription.plan.basic')}</SelectItem>
                                  <SelectItem value="Pro">{t('subscription.plan.pro')}</SelectItem>
                                  <SelectItem value="VIP">{t('subscription.plan.vip')}</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormDescription>{t('subscription.plan.description')}</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        {seller.subscription.plan !== 'VIP' && (
                          <div className="flex flex-wrap gap-2">
                            {['Basic', 'Pro', 'VIP']
                              .filter((plan) => plan !== seller.subscription.plan)
                              .map((plan) => (
                                <Button
                                  key={plan}
                                  variant="outline"
                                  onClick={() => handleUpgradeSubscription(plan as 'Basic' | 'Pro' | 'VIP')}
                                >
                                  {t('subscription.upgradeTo', { plan })}
                                </Button>
                              ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                  {/* Discount Offers Tab */}
                  <TabsContent value="discounts" id="discounts">
                    <Card>
                      <CardHeader>
                        <CardTitle>{t('sections.discountOffers')}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {discountFields.map((field, index) => (
                          <div key={field.id} className="border p-4 rounded-lg space-y-4">
                            <FormField
                              control={form.control}
                              name={`discountOffers.${index}.code`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('discountOffers.code.label')}</FormLabel>
                                  <FormControl>
                                    <Input placeholder={t('discountOffers.code.placeholder')} {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`discountOffers.${index}.description`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('discountOffers.description.label')}</FormLabel>
                                  <FormControl>
                                    <Textarea placeholder={t('discountOffers.description.placeholder')} {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`discountOffers.${index}.discountType`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('discountOffers.discountType.label')}</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder={t('discountOffers.discountType.placeholder')} />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="percentage">{t('discountOffers.discountType.percentage')}</SelectItem>
                                      <SelectItem value="fixed">{t('discountOffers.discountType.fixed')}</SelectItem>
                                      <SelectItem value="free_shipping">{t('discountOffers.discountType.free_shipping')}</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`discountOffers.${index}.discountValue`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('discountOffers.discountValue.label')}</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      placeholder={t('discountOffers.discountValue.placeholder')}
                                      {...field}
                                      onChange={(e) => field.onChange(Number(e.target.value))}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`discountOffers.${index}.minPurchase`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('discountOffers.minPurchase.label')}</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      placeholder={t('discountOffers.minPurchase.placeholder')}
                                      {...field}
                                      onChange={(e) => field.onChange(Number(e.target.value))}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`discountOffers.${index}.maxDiscount`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('discountOffers.maxDiscount.label')}</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      placeholder={t('discountOffers.maxDiscount.placeholder')}
                                      {...field}
                                      onChange={(e) => field.onChange(Number(e.target.value))}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`discountOffers.${index}.validFrom`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('discountOffers.validFrom.label')}</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="date"
                                      {...field}
                                      value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''}
                                      onChange={(e) => field.onChange(new Date(e.target.value))}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`discountOffers.${index}.validUntil`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('discountOffers.validUntil.label')}</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="date"
                                      {...field}
                                      value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''}
                                      onChange={(e) => field.onChange(new Date(e.target.value))}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`discountOffers.${index}.maxUses`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('discountOffers.maxUses.label')}</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      placeholder={t('discountOffers.maxUses.placeholder')}
                                      {...field}
                                      onChange={(e) => field.onChange(Number(e.target.value))}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`discountOffers.${index}.isActive`}
                              render={({ field }) => (
                                <FormItem className="flex items-center justify-between">
                                  <div>
                                    <FormLabel>{t('discountOffers.isActive.label')}</FormLabel>
                                    <FormDescription>{t('discountOffers.isActive.description')}</FormDescription>
                                  </div>
                                  <FormControl>
                                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <Button variant="destructive" size="sm" onClick={() => removeDiscount(index)}>
                              <Trash2 className="h-4 w-4 mr-2" />
                              {t('discountOffers.remove')}
                            </Button>
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            appendDiscount({
                              code: '',
                              description: '',
                              discountType: 'percentage',
                              discountValue: 0,
                              minPurchase: 0,
                              maxDiscount: 0,
                              validFrom: undefined,
                              validUntil: undefined,
                              maxUses: 0,
                              usedCount: 0,
                              isActive: true,
                              applicableProducts: [],
                              applicableCategories: [],
                            })
                          }
                        >
                          {t('discountOffers.add')}
                        </Button>
                      </CardContent>
                    </Card>
                  </TabsContent>
                  {/* Notifications Tab */}
                  <TabsContent value="notifications" id="notifications">
                    <Card>
                      <CardHeader>
                        <CardTitle>{t('sections.notifications')}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <FormField
                          control={form.control}
                          name="notifications.email"
                          render={({ field }) => (
                            <FormItem className="flex items-center justify-between">
                              <div>
                                <FormLabel>{t('notifications.email.label')}</FormLabel>
                                <FormDescription>{t('notifications.email.description')}</FormDescription>
                              </div>
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="notifications.sms"
                          render={({ field }) => (
                            <FormItem className="flex items-center justify-between">
                              <div>
                                <FormLabel>{t('notifications.sms.label')}</FormLabel>
                                <FormDescription>{t('notifications.sms.description')}</FormDescription>
                              </div>
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="notifications.push"
                          render={({ field }) => (
                            <FormItem className="flex items-center justify-between">
                              <div>
                                <FormLabel>{t('notifications.push.label')}</FormLabel>
                                <FormDescription>{t('notifications.push.description')}</FormDescription>
                              </div>
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="notifications.orderUpdates"
                          render={({ field }) => (
                            <FormItem className="flex items-center justify-between">
                              <div>
                                <FormLabel>{t('notifications.orderUpdates.label')}</FormLabel>
                                <FormDescription>{t('notifications.orderUpdates.description')}</FormDescription>
                              </div>
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="notifications.marketingEmails"
                          render={({ field }) => (
                            <FormItem className="flex items-center justify-between">
                              <div>
                                <FormLabel>{t('notifications.marketingEmails.label')}</FormLabel>
                                <FormDescription>{t('notifications.marketingEmails.description')}</FormDescription>
                              </div>
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="notifications.pointsNotifications"
                          render={({ field }) => (
                            <FormItem className="flex items-center justify-between">
                              <div>
                                <FormLabel>{t('notifications.pointsNotifications.label')}</FormLabel>
                                <FormDescription>{t('notifications.pointsNotifications.description')}</FormDescription>
                              </div>
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>
                  {/* Display Tab */}
                  <TabsContent value="display" id="display">
                    <Card>
                      <CardHeader>
                        <CardTitle>{t('sections.display')}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <FormField
                          control={form.control}
                          name="display.showRating"
                          render={({ field }) => (
                            <FormItem className="flex items-center justify-between">
                              <div>
                                <FormLabel>{t('display.showRating.label')}</FormLabel>
                                <FormDescription>{t('display.showRating.description')}</FormDescription>
                              </div>
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="display.showContactInfo"
                          render={({ field }) => (
                            <FormItem className="flex items-center justify-between">
                              <div>
                                <FormLabel>{t('display.showContactInfo.label')}</FormLabel>
                                <FormDescription>{t('display.showContactInfo.description')}</FormDescription>
                              </div>
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="display.showMetrics"
                          render={({ field }) => (
                            <FormItem className="flex items-center justify-between">
                              <div>
                                <FormLabel>{t('display.showMetrics.label')}</FormLabel>
                                <FormDescription>{t('display.showMetrics.description')}</FormDescription>
                              </div>
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="display.showPointsBalance"
                          render={({ field }) => (
                            <FormItem className="flex items-center justify-between">
                              <div>
                                <FormLabel>{t('display.showPointsBalance.label')}</FormLabel>
                                <FormDescription>{t('display.showPointsBalance.description')}</FormDescription>
                              </div>
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="display.welcomeSeen"
                          render={({ field }) => (
                            <FormItem className="flex items-center justify-between">
                              <div>
                                <FormLabel>{t('display.welcomeSeen.label')}</FormLabel>
                                <FormDescription>{t('display.welcomeSeen.description')}</FormDescription>
                              </div>
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>
                  {/* Custom Site Tab */}
                  <TabsContent value="customSite" id="customSite">
                    <Card>
                      <CardHeader>
                        <CardTitle>{t('sections.customSite')}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <FormField
                          control={form.control}
                          name="customSite.theme"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('customSite.theme.label')}</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder={t('customSite.theme.placeholder')} />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="default">{t('customSite.theme.default')}</SelectItem>
                                  <SelectItem value="dark">{t('customSite.theme.dark')}</SelectItem>
                                  <SelectItem value="light">{t('customSite.theme.light')}</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormDescription>{t('customSite.theme.description')}</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="customSite.primaryColor"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('customSite.primaryColor.label')}</FormLabel>
                              <FormControl>
                                <div className="flex items-center space-x-2">
                                  <Input type="color" {...field} className="w-12 h-10 p-1" />
                                  <Input {...field} placeholder="#000000" />
                                </div>
                              </FormControl>
                              <FormDescription>{t('customSite.primaryColor.description')}</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="customSite.logo"
                          render={({ field: { value, onChange, ...field } }) => (
                            <FormItem>
                              <FormLabel>{t('customSite.logo.label')}</FormLabel>
                              <FormControl>
                                <div className="space-y-2">
                                  <Input
                                    type="file"
                                    accept={ACCEPTED_IMAGE_TYPES.join(',')}
                                    onChange={(e) => {
                                      onChange(e.target.files?.[0]);
                                      handleImageUpload(e, 'logo');
                                    }}
                                    {...field}
                                  />
                                  {logoPreview && (
                                    <div className="w-32 h-32 border rounded-lg overflow-hidden">
                                      <img
                                        src={logoPreview}
                                        alt={t('customSite.logo.alt')}
                                        className="w-full h-full object-contain"
                                      />
                                    </div>
                                  )}
                                </div>
                              </FormControl>
                              <FormDescription>{t('customSite.logo.description')}</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="customSite.bannerImage"
                          render={({ field: { value, onChange, ...field } }) => (
                            <FormItem>
                              <FormLabel>{t('customSite.bannerImage.label')}</FormLabel>
                              <FormControl>
                                <div className="space-y-2">
                                  <Input
                                    type="file"
                                    accept={ACCEPTED_IMAGE_TYPES.join(',')}
                                    onChange={(e) => {
                                      onChange(e.target.files?.[0]);
                                      handleImageUpload(e, 'banner');
                                    }}
                                    {...field}
                                  />
                                  {bannerPreview && (
                                    <div className="w-full h-32 border rounded-lg overflow-hidden">
                                      <img
                                        src={bannerPreview}
                                        alt={t('customSite.bannerImage.alt')}
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                  )}
                                </div>
                              </FormControl>
                              <FormDescription>{t('customSite.bannerImage.description')}</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="customSite.seo.metaTitle"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('customSite.seo.metaTitle.label')}</FormLabel>
                              <FormControl>
                                <Input placeholder={t('customSite.seo.metaTitle.placeholder')} {...field} />
                              </FormControl>
                              <FormDescription>{t('customSite.seo.metaTitle.description')}</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="customSite.seo.metaDescription"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('customSite.seo.metaDescription.label')}</FormLabel>
                              <FormControl>
                                <Textarea placeholder={t('customSite.seo.metaDescription.placeholder')} {...field} />
                              </FormControl>
                              <FormDescription>{t('customSite.seo.metaDescription.description')}</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="customSite.seo.keywords"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('customSite.seo.keywords.label')}</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder={t('customSite.seo.keywords.placeholder')}
                                  {...field}
                                  value={field.value?.join(',') || ''}
                                  onChange={(e) => field.onChange(e.target.value.split(',').map((v) => v.trim()))}
                                />
                              </FormControl>
                              <FormDescription>{t('customSite.seo.keywords.description')}</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>
                  {/* Taxes Tab */}
                  <TabsContent value="taxes" id="taxes">
                    <Card>
                      <CardHeader>
                        <CardTitle>{t('sections.taxes')}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <FormField
                          control={form.control}
                          name="taxSettings.US"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('taxes.taxRate.label')} (US)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  placeholder={t('taxes.taxRate.placeholder')}
                                  value={field.value?.taxRate || 0}
                                  onChange={(e) =>
                                    field.onChange({
                                      ...field.value,
                                      taxRate: Number(e.target.value),
                                      countryCode: 'US',
                                      taxType: field.value?.taxType || 'none',
                                      taxService: field.value?.taxService || 'none',
                                    })
                                  }
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="taxSettings.US.taxType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('taxes.taxType.label')}</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value || 'none'}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder={t('taxes.taxType.placeholder')} />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="vat">{t('taxes.taxType.vat')}</SelectItem>
                                  <SelectItem value="sales_tax">{t('taxes.taxType.sales_tax')}</SelectItem>
                                  <SelectItem value="none">{t('taxes.taxType.none')}</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="taxSettings.US.taxService"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('taxes.taxService.label')}</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value || 'none'}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder={t('taxes.taxService.placeholder')} />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="avalara">{t('taxes.taxService.avalara')}</SelectItem>
                                  <SelectItem value="taxjar">{t('taxes.taxService.taxjar')}</SelectItem>
                                  <SelectItem value="none">{t('taxes.taxService.none')}</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>
                  {/* Domains Tab */}
                  <TabsContent value="domainstb" id="domainstb">
                    <Card>
                      <CardHeader>
                        <CardTitle>{t('sections.domains')}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {domainFields.map((field, index) => (
                          <div key={field.id} className="border p-4 rounded-lg space-y-4">
                            <FormField
                              control={form.control}
                              name={`domains.${index}.domainName`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('domains.domainName.label')}</FormLabel>
                                  <FormControl>
                                    <Input placeholder={t('domains.domainName.placeholder')} {...field} />
                                  </FormControl>
                                  <FormDescription>{t('domains.domainName.description')}</FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`domains.${index}.isPrimary`}
                              render={({ field }) => (
                                <FormItem className="flex items-center justify-between">
                                  <div>
                                    <FormLabel>{t('domains.isPrimary.label')}</FormLabel>
                                    <FormDescription>{t('domains.isPrimary.description')}</FormDescription>
                                  </div>
                                  <FormControl>
                                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`domains.${index}.dnsStatus`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('domains.dnsStatus.label')}</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder={t('domains.dnsStatus.placeholder')} />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="pending">{t('domains.dnsStatus.pending')}</SelectItem>
                                      <SelectItem value="verified">{t('domains.dnsStatus.verified')}</SelectItem>
                                      <SelectItem value="failed">{t('domains.dnsStatus.failed')}</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormDescription>{t('domains.dnsStatus.description')}</FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <Button variant="destructive" size="sm" onClick={() => removeDomain(index)}>
                              <Trash2 className="h-4 w-4 mr-2" />
                              {t('domains.remove')}
                            </Button>
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            appendDomain({
                              domainName: '',
                              isPrimary: false,
                              dnsStatus: 'pending',
                            })
                          }
                        >
                          {t('domains.add')}
                        </Button>
                      </CardContent>
                    </Card>
                  </TabsContent>
                  {/* Verification Tab */}
                  <TabsContent value="verification" id="verification">
                    <Card>
                      <CardHeader>
                        <CardTitle>{t('sections.verification')}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {form.getValues('verification.documents')?.map((doc, index) => (
                          <div key={index} className="border p-4 rounded-lg space-y-4">
                            <FormField
                              control={form.control}
                              name={`verification.documents.${index}.type`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('verification.documentType.label')}</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder={t('verification.documentType.placeholder')} />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="id">{t('verification.documentType.id')}</SelectItem>
                                      <SelectItem value="business_license">{t('verification.documentType.business_license')}</SelectItem>
                                      <SelectItem value="tax_document">{t('verification.documentType.tax_document')}</SelectItem>
                                      <SelectItem value="other">{t('verification.documentType.other')}</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`verification.documents.${index}.url`}
                              render={({ field: { value, onChange, ...field } }) => (
                                <FormItem>
                                  <FormLabel>{t('verification.document.label')}</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="file"
                                      accept={ACCEPTED_DOCUMENT_TYPES.join(',')}
                                      onChange={(e) => onChange(e.target.files?.[0])}
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                const documents = form.getValues('verification.documents') || [];
                                form.setValue(
                                  'verification.documents',
                                  documents.filter((_, i) => i !== index)
                                );
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {t('verification.removeDocument')}
                            </Button>
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            form.setValue('verification.documents', [
                              ...(form.getValues('verification.documents') || []),
                              { type: 'other', status: 'pending', uploadedAt: new Date() },
                            ])
                          }
                        >
                          {t('verification.addDocument')}
                        </Button>
                      </CardContent>
                    </Card>
                  </TabsContent>
                  {/* Integrations Tab */}
                  <TabsContent value="integrations" id="verification">
                    <Card>
                      <CardHeader>
                        <CardTitle>{t('sections.integrations')}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <p>{t('integrations.description')}</p>
                        <div>
                          <h3>{t('integrations.payment')}</h3>
                          {availablePaymentProviders.length > 0 ? (
                            <ul>
                              {availablePaymentProviders.map((provider, index) => (
                                <li key={index}>{provider.providerName}</li>
                              ))}
                            </ul>
                          ) : (
                            <p>{t('integrations.noPaymentProviders')}</p>
                          )}
                        </div>
                        <div>
                          <h3>{t('integrations.shipping')}</h3>
                          {availableShippingProviders.length > 0 ? (
                            <ul>
                              {availableShippingProviders.map((provider, index) => (
                                <li key={index}>{provider.providerName}</li>
                              ))}
                            </ul>
                          ) : (
                            <p>{t('integrations.noShippingProviders')}</p>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => router.push(`/seller/${seller.customSiteUrl}/integrations`)}
                        >
                          {t('integrations.manage')}
                        </Button>
                      </CardContent>
                    </Card>
                  </TabsContent>
                  {/* Integrations Manager Tab */}
                  <TabsContent value="integrationsmanager" id="integrationsmanager">
                    <Card>
                      <CardHeader>
                        <CardTitle>{t('sections.integrationsmanager')}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <IntegrationsManager storeId={seller.storeId} />
                      </CardContent>
                    </Card>
                  </TabsContent>
                  {/* Payment Methods Tab */}
                  <TabsContent value="paymentMethods" id="paymentMethods">
                    <Card>
                      <CardHeader>
                        <CardTitle>{t('sections.paymentMethods')}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <SellerPaymentMethodForm
                          id="seller-payment-methods"
                          form={form}
                          availablePaymentProviders={availablePaymentProviders}
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>
                  {/* Delivery Dates Tab */}

                  <TabsContent value="managePages" id="managePages">
                    <Card>
                      <CardHeader>
                        <CardTitle>{t('sections.managePages')}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <PageManager
                          id="managePages"
                          form={form}
                          availablePaymentProviders={availablePaymentProviders}
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>
                  <TabsContent value="deliveryDates" id="deliveryDates">
                    <Card>
                      <CardHeader>
                        <CardTitle>{t('sections.shippingOptions')}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <SellerDeliveryDateForm
                          id="seller-delivery-dates"
                          form={form}
                          availableShippingProviders={availableShippingProviders}
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>
                  <TabsContent value="messages" id="messages">
                    <Card>
                      <CardHeader>
                        <CardTitle>{t('sections.messages')}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <MessagesManager storeId={seller.storeId} />
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
                {/* Submit Button */}
                <Button type="submit" disabled={isLoading} className="w-full">
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('submitting')}
                    </>
                  ) : (
                    t('submit')
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
      <div className="w-1/3">
        <Card>
          <CardHeader>
            <CardTitle>{t('preview')}</CardTitle>
          </CardHeader>
          <CardContent>
            <SitePreview
              settings={previewData.customSite}
              template={previewData.template}
              storeId={seller.storeId}
            />
          </CardContent>
        </Card>
      </div>
      
    </div>
  );
}