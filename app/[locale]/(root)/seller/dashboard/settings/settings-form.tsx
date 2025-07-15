// /home/hager/Trash/my-nextjs-project-master/app/[locale]/(root)/seller/dashboard/settings/settings-form.tsx

'use client';

import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
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
import { Loader2, Upload, Eye, EyeOff, Trash2 } from 'lucide-react';
import { updateSellerSettings, getSellerByUserId, updateSellerSubscription } from '@/lib/actions/seller.actions';
import { SettingsFormData, SettingsFormDataSchema } from '@/lib/types/settings';
import { ISeller } from '@/lib/db/models/seller.model';
import { SellerIntegration } from '@/lib/db/models/seller-integration.model';
// حدود حجم ونوع الملفات
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

// مخطط التحقق باستخدام الترجمات
const settingsFormSchema = (t: any) =>
  SettingsFormDataSchema.refine(
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

type SettingsFormValues = SettingsFormData;

export default function SellerSettingsForm({ seller }: { seller: ISeller }) {
  const t = useTranslations('SellerSettings');
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [showBankInfo, setShowBankInfo] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(seller.logo || null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(
    seller.settings?.customSite?.bannerImage || null
  );
  const [pointsBalance, setPointsBalance] = useState(seller.pointsBalance || 0);
  const [trialDaysRemaining, setTrialDaysRemaining] = useState(0);

  // تهيئة النموذج
  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema(t)),
    defaultValues: {
      businessName: seller.businessName || '',
      description: seller.description || '',
      email: seller.email || '',
      phone: seller.phone || '',
      address: {
        street: seller.address?.street || '',
        city: seller.address?.city || '',
        state: seller.address?.state || '',
        country: seller.address?.country || '',
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
        orderUpdates: seller.settings?.notifications?.orderUpdates ?? true,
        marketingEmails: seller.settings?.notifications?.marketingEmails ?? false,
        pointsNotifications: seller.settings?.notifications?.pointsNotifications ?? true,
      },
      display: {
        showRating: seller.settings?.display?.showRating ?? true,
        showContactInfo: seller.settings?.display?.showContactInfo ?? true,
        showMetrics: seller.settings?.display?.showMetrics ?? true,
        showPointsBalance: seller.settings?.display?.showPointsBalance ?? true,
      },
      security: {
        twoFactorAuth: seller.settings?.security?.twoFactorAuth ?? false,
        loginNotifications: seller.settings?.security?.loginNotifications ?? true,
      },
      customSite: {
        theme: seller.settings?.customSite?.theme ?? 'default',
        primaryColor: seller.settings?.customSite?.primaryColor ?? '#000000',
        bannerImage: undefined,
        customSections: seller.settings?.customSite?.customSections ?? [],
      },
      shippingOptions: seller.shippingOptions || [],
      discountOffers: seller.discountOffers || [],
      paymentGateways: seller.paymentGateways || [],
    },
  });

  const { fields: shippingFields, append: appendShipping, remove: removeShipping } = useFieldArray({
    control: form.control,
    name: 'shippingOptions',
  });

  const { fields: discountFields, append: appendDiscount, remove: removeDiscount } = useFieldArray({
    control: form.control,
    name: 'discountOffers',
  });

  // جلب بيانات البائع وحساب أيام الفترة التجريبية
  useEffect(() => {
    async function fetchSettings() {
      try {
        const session = await fetch('/api/auth/session').then((res) => res.json());
        if (!session?.user?.id) {
          toast({
            title: t('errors.unauthorizedTitle'),
            description: t('errors.unauthorizedDescription'),
            variant: 'destructive',
          });
          router.push('/login');
          return;
        }

        const response = await getSellerByUserId(session.user.id);
        if (response.success && response.data) {
          const sellerData: ISeller = response.data;
          form.reset({
            businessName: sellerData.businessName,
            description: sellerData.description || '',
            email: sellerData.email,
            phone: sellerData.phone,
            address: sellerData.address,
            bankInfo: {
              accountName: sellerData.bankInfo?.accountName || '',
              accountNumber: '',
              bankName: sellerData.bankInfo?.bankName || '',
              swiftCode: sellerData.bankInfo?.swiftCode || '',
              verified: sellerData.bankInfo?.verified || false,
            },
            notifications: sellerData.settings.notifications,
            display: sellerData.settings.display,
            security: sellerData.settings.security,
            customSite: {
              theme: sellerData.settings.customSite?.theme ?? 'default',
              primaryColor: sellerData.settings.customSite?.primaryColor ?? '#000000',
              bannerImage: undefined,
              customSections: sellerData.settings.customSite?.customSections ?? [],
            },
            shippingOptions: sellerData.shippingOptions || [],
            discountOffers: sellerData.discountOffers || [],
            paymentGateways: sellerData.paymentGateways || [],
          });
          setPointsBalance(sellerData.pointsBalance);
          setLogoPreview(sellerData.logo || null);
          setBannerPreview(sellerData.settings.customSite?.bannerImage || null);
          if (sellerData.freeTrialActive && sellerData.freeTrialEndDate) {
            const now = new Date();
            const endDate = new Date(sellerData.freeTrialEndDate);
            const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
            setTrialDaysRemaining(daysRemaining > 0 ? daysRemaining : 0);
          }
        } else {
          throw new Error(response.message || t('errors.fetchDescription'));
        }
      } catch (error) {
        toast({
          title: t('errors.fetchTitle'),
          description: error instanceof Error ? error.message : t('errors.fetchDescription'),
          variant: 'destructive',
        });
      } finally {
        setIsFetching(false);
      }
    }
    fetchSettings();
  }, [form, toast, t, router]);

  // استطلاع تحديثات النقاط في الوقت الفعلي
  useEffect(() => {
    const interval = setInterval(async () => {
      const session = await fetch('/api/auth/session').then((res) => res.json());
      if (session?.user?.id) {
        const response = await getSellerByUserId(session.user.id);
        if (response.success && response.data) {
          setPointsBalance(response.data.pointsBalance);
        }
      }
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // معالجة رفع الصور
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'banner') => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: t('errors.fileSizeTitle'),
          description: t('errors.fileSizeDescription', { size: '2MB' }),
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

  // معالجة إرسال النموذج
  const handleSubmit = async (data: SettingsFormValues) => {
    setIsLoading(true);
    try {
      const session = await fetch('/api/auth/session').then((res) => res.json());
      if (!session?.user?.id) {
        throw new Error(t('errors.unauthorizedDescription'));
      }

      const logoFile = data.customSite.logo?.[0];
      const bannerFile = data.customSite.bannerImage?.[0];
      const formData = new FormData();
      if (logoFile) formData.append('logo', logoFile);
      if (bannerFile) formData.append('bannerImage', bannerFile);

      const settings: SettingsFormData = {
        businessName: data.businessName,
        description: data.description,
        email: data.email,
        phone: data.phone,
        address: data.address,
        bankInfo: showBankInfo ? data.bankInfo : undefined,
        notifications: data.notifications,
        display: data.display,
        security: data.security,
        customSite: {
          theme: data.customSite.theme,
          primaryColor: data.customSite.primaryColor,
          bannerImage: bannerFile ? undefined : data.customSite.bannerImage,
          customSections: data.customSite.customSections,
        },
        shippingOptions: data.shippingOptions,
        discountOffers: data.discountOffers,
        paymentGateways: data.paymentGateways,
      };

      const result = await updateSellerSettings(settings, formData);
      if (!result.success) {
        throw new Error(result.error || t('errors.submitDescription'));
      }

      toast({
        title: t('success.title'),
        description: t('success.description'),
      });
      form.reset(data);
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

  // معالجة ترقية الاشتراك
  const handleUpgradeSubscription = async (plan: 'Basic' | 'Pro' | 'VIP') => {
    try {
      const response = await updateSellerSubscription(seller.userId, { plan, pointsToRedeem: 0 });
      if (response.success) {
        toast({
          title: t('success.title'),
          description: t('success.subscriptionUpgraded', { plan }),
        });
        router.refresh();
      } else {
        throw new Error(response.error || t('errors.submitDescription'));
      }
    } catch (error) {
      toast({
        title: t('errors.submitTitle'),
        description: error instanceof Error ? error.message : t('errors.submitDescription'),
        variant: 'destructive',
      });
    }
  };

  // عرض حالة التحميل
  if (isFetching) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <Card className="max-w-4xl mx-auto my-8">
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
            {/* قسم معلومات الأعمال */}
            <Card>
              <CardHeader>
                <CardTitle>{t('sections.businessInfo')}</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid gap-6">
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
                          <Textarea
                            placeholder={t('description.placeholder')}
                            className="h-32"
                            {...field}
                          />
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
                </div>
              </CardContent>
            </Card>

            {/* قسم العنوان */}
            <Card>
              <CardHeader>
                <CardTitle>{t('sections.address')}</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
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
                    name="address.country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('address.country.label')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('address.country.placeholder')} {...field} />
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
                            onChange={(e) => {
                              const value = e.target.value.toUpperCase();
                              field.onChange(value);
                            }}
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
                            onChange={(e) => {
                              const value = e.target.value.toUpperCase();
                              field.onChange(value);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* قسم معلومات البنك */}
            <Card>
              <CardHeader>
                <CardTitle>{t('sections.bankInfo')}</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
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
                              onChange={(e) => {
                                const value = e.target.value.toUpperCase();
                                field.onChange(value);
                              }}
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

            {/* قسم الاشتراك */}
            <Card>
              <CardHeader>
                <CardTitle>{t('sections.subscription')}</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="subscription.plan"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('subscription.plan.label')}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={seller.subscription.plan}>
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
                </div>
              </CardContent>
            </Card>

            {/* قسم خيارات الشحن */}
            <Card>
              <CardHeader>
                <CardTitle>{t('sections.shippingOptions')}</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {shippingFields.map((field, index) => (
                    <div key={field.id} className="border p-4 rounded-lg space-y-4">
                      <FormField
                        control={form.control}
                        name={`shippingOptions.${index}.name`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('shippingOptions.name.label')}</FormLabel>
                            <FormControl>
                              <Input placeholder={t('shippingOptions.name.placeholder')} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`shippingOptions.${index}.daysToDeliver`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('shippingOptions.daysToDeliver.label')}</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder={t('shippingOptions.daysToDeliver.placeholder')}
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
                        name={`shippingOptions.${index}.shippingPrice`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('shippingOptions.shippingPrice.label')}</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder={t('shippingOptions.shippingPrice.placeholder')}
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
                        name={`shippingOptions.${index}.freeShippingMinPrice`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('shippingOptions.freeShippingMinPrice.label')}</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder={t('shippingOptions.freeShippingMinPrice.placeholder')}
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
                        name={`shippingOptions.${index}.supportedCountries`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('shippingOptions.supportedCountries.label')}</FormLabel>
                            <FormControl>
                              <Input
                                placeholder={t('shippingOptions.supportedCountries.placeholder')}
                                {...field}
                                value={field.value?.join(',') || ''}
                                onChange={(e) => field.onChange(e.target.value.split(',').map((v) => v.trim().toUpperCase()))}
                              />
                            </FormControl>
                            <FormDescription>
                              {t('shippingOptions.supportedCountries.description')}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`shippingOptions.${index}.isActive`}
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between">
                            <div>
                              <FormLabel>{t('shippingOptions.isActive.label')}</FormLabel>
                              <FormDescription>
                                {t('shippingOptions.isActive.description')}
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => removeShipping(index)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {t('shippingOptions.remove')}
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      appendShipping({
                        name: '',
                        daysToDeliver: 0,
                        shippingPrice: 0,
                        freeShippingMinPrice: 0,
                        supportedCountries: [],
                        isActive: true,
                      })
                    }
                  >
                    {t('shippingOptions.add')}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* قسم عروض الخصم */}
            <Card>
              <CardHeader>
                <CardTitle>{t('sections.discountOffers')}</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
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
                              <Textarea
                                placeholder={t('discountOffers.description.placeholder')}
                                {...field}
                              />
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
                                value={field.value ? field.value.toISOString().split('T')[0] : ''}
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
                                value={field.value ? field.value.toISOString().split('T')[0] : ''}
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
                              <FormDescription>
                                {t('discountOffers.isActive.description')}
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => removeDiscount(index)}
                      >
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
                </div>
              </CardContent>
            </Card>

            {/* قسم الإشعارات */}
            <Card>
              <CardHeader>
                <CardTitle>{t('sections.notifications')}</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid gap-6">
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
                    name="notifications.orderUpdates"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between">
                        <div>
                          <FormLabel>{t('notifications.orderUpdates.label')}</FormLabel>
                          <FormDescription>
                            {t('notifications.orderUpdates.description')}
                          </FormDescription>
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
                          <FormDescription>
                            {t('notifications.marketingEmails.description')}
                          </FormDescription>
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
                          <FormDescription>
                            {t('notifications.pointsNotifications.description')}
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* قسم العرض */}
            <Card>
              <CardHeader>
                <CardTitle>{t('sections.display')}</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid gap-6">
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
                          <FormDescription>
                            {t('display.showContactInfo.description')}
                          </FormDescription>
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
                          <FormDescription>
                            {t('display.showPointsBalance.description')}
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* قسم الأمان */}
            <Card>
              <CardHeader>
                <CardTitle>{t('sections.security')}</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid gap-6">
                  <FormField
                    control={form.control}
                    name="security.twoFactorAuth"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between">
                        <div>
                          <FormLabel>{t('security.twoFactorAuth.label')}</FormLabel>
                          <FormDescription>{t('security.twoFactorAuth.description')}</FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="security.loginNotifications"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between">
                        <div>
                          <FormLabel>{t('security.loginNotifications.label')}</FormLabel>
                          <FormDescription>
                            {t('security.loginNotifications.description')}
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* قسم الموقع المخصص */}
            <Card>
              <CardHeader>
                <CardTitle>{t('sections.customSite')}</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid gap-6">
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
                                onChange(e.target.files);
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
                                onChange(e.target.files);
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
                </div>
              </CardContent>
            </Card>

            {/* زر الحفظ */}
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
  );
}