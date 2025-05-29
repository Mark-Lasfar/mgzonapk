'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Upload, Eye, EyeOff } from 'lucide-react'
import { updateSellerSettings, getSellerByUserId, updateSellerSubscription } from '@/lib/actions/seller.actions'
import { ISeller } from '@/lib/db/models/seller.model'

// حدود حجم ونوع الملفات
const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

// مخطط التحقق باستخدام الترجمات
const settingsFormSchema = (t: any) =>
  z.object({
    businessName: z
      .string()
      .min(2, t('validation.businessName.min', { count: 2 }))
      .max(100, t('validation.businessName.max', { count: 100 })),
    description: z
      .string()
      .min(10, t('validation.description.min', { count: 10 }))
      .max(500, t('validation.description.max', { count: 500 }))
      .optional(),
    phone: z
      .string()
      .min(10, t('validation.phone.min', { count: 10 }))
      .max(20, t('validation.phone.max', { count: 20 }))
      .regex(/^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/, t('validation.phone.format')),
    address: z.object({
      street: z.string().min(1, t('validation.address.street.required')),
      city: z.string().min(1, t('validation.address.city.required')),
      state: z.string().min(1, t('validation.address.state.required')),
      country: z.string().min(1, t('validation.address.country.required')),
      postalCode: z
        .string()
        .min(1, t('validation.address.postalCode.required'))
        .regex(/^[0-9A-Z\s-]*$/, t('validation.address.postalCode.format')),
    }),
    bankInfo: z
      .object({
        accountName: z
          .string()
          .min(2, t('validation.bankInfo.accountName.min', { count: 2 }))
          .max(100, t('validation.bankInfo.accountName.max', { count: 100 })),
        accountNumber: z
          .string()
          .min(8, t('validation.bankInfo.accountNumber.min', { count: 8 }))
          .max(34, t('validation.bankInfo.accountNumber.max', { count: 34 }))
          .regex(/^[0-9]*$/, t('validation.bankInfo.accountNumber.format')),
        bankName: z
          .string()
          .min(2, t('validation.bankInfo.bankName.min', { count: 2 }))
          .max(100, t('validation.bankInfo.bankName.max', { count: 100 })),
        swiftCode: z
          .string()
          .min(8, t('validation.bankInfo.swiftCode.min', { count: 8 }))
          .max(11, t('validation.bankInfo.swiftCode.max', { count: 11 }))
          .regex(/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/, t('validation.bankInfo.swiftCode.format')),
      })
      .optional(),
    subscription: z.object({
      plan: z.enum(['Trial', 'Basic', 'Pro', 'VIP'], {
        required_error: t('validation.subscription.plan.required'),
      }),
    }),
    notifications: z.object({
      email: z.boolean(),
      sms: z.boolean(),
      orderUpdates: z.boolean(),
      marketingEmails: z.boolean(),
      pointsNotifications: z.boolean(),
    }),
    display: z.object({
      showRating: z.boolean(),
      showContactInfo: z.boolean(),
      showMetrics: z.boolean(),
      showPointsBalance: z.boolean(),
    }),
    security: z.object({
      twoFactorAuth: z.boolean(),
      loginNotifications: z.boolean(),
    }),
    customSite: z.object({
      theme: z.string().min(1, t('validation.customSite.theme.required')),
      primaryColor: z
        .string()
        .regex(/^#[0-9A-F]{6}$/i, t('validation.customSite.primaryColor.invalid')),
      logo: z
        .any()
        .refine(
          (files) => !files?.[0] || files[0].size <= MAX_FILE_SIZE,
          t('validation.customSite.logo.size', { size: '2MB' }),
        )
        .refine(
          (files) => !files?.[0] || ACCEPTED_IMAGE_TYPES.includes(files[0].type),
          t('validation.customSite.logo.format'),
        )
        .optional(),
      bannerImage: z
        .any()
        .refine(
          (files) => !files?.[0] || files[0].size <= MAX_FILE_SIZE,
          t('validation.customSite.bannerImage.size', { size: '2MB' }),
        )
        .refine(
          (files) => !files?.[0] || ACCEPTED_IMAGE_TYPES.includes(files[0].type),
          t('validation.customSite.bannerImage.format'),
        )
        .optional(),
    }),
  })

type SettingsFormValues = z.infer<ReturnType<typeof settingsFormSchema>>

export default function SellerSettingsForm({ seller }: { seller: ISeller }) {
  const t = useTranslations('SellerSettings')
  const { toast } = useToast()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(true)
  const [showBankInfo, setShowBankInfo] = useState(false)
  const [logoPreview, setLogoPreview] = useState<string | null>(seller.logo || null)
  const [bannerPreview, setBannerPreview] = useState<string | null>(seller.settings?.customSite?.bannerImage || null)
  const [pointsBalance, setPointsBalance] = useState(seller.pointsBalance || 0)
  const [trialDaysRemaining, setTrialDaysRemaining] = useState(0)

  // تهيئة النموذج
  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema(t)),
    defaultValues: {
      businessName: seller.businessName || '',
      description: seller.description || '',
      phone: seller.phone || '',
      address: {
        street: seller.address?.street || '',
        city: seller.address?.city || '',
        state: seller.address?.state || '',
        country: seller.address?.country || '',
        postalCode: seller.address?.postalCode || '',
      },
      bankInfo: {
        accountName: seller.bankInfo?.accountName || '',
        accountNumber: '', // لا يتم عرض رقم الحساب افتراضيًا
        bankName: seller.bankInfo?.bankName || '',
        swiftCode: seller.bankInfo?.swiftCode || '',
      },
      subscription: {
        plan: seller.subscription?.plan || 'Trial',
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
        logo: null,
        bannerImage: null,
      },
    },
  })

  // جلب بيانات البائع وحساب أيام الفترة التجريبية
  useEffect(() => {
    async function fetchSettings() {
      try {
        const session = await fetch('/api/auth/session').then((res) => res.json())
        if (!session?.user?.id) {
          toast({
            title: t('errors.unauthorizedTitle'),
            description: t('errors.unauthorizedDescription'),
            variant: 'destructive',
          })
          router.push('/login')
          return
        }

        const response = await getSellerByUserId(session.user.id)
        if (response.success && response.data) {
          const sellerData: ISeller = response.data
          form.reset({
            businessName: sellerData.businessName,
            description: sellerData.description || '',
            phone: sellerData.phone,
            address: sellerData.address,
            bankInfo: {
              accountName: sellerData.bankInfo?.accountName || '',
              accountNumber: '', // لا يتم عرض رقم الحساب
              bankName: sellerData.bankInfo?.bankName || '',
              swiftCode: sellerData.bankInfo?.swiftCode || '',
            },
            subscription: { plan: sellerData.subscription.plan },
            notifications: sellerData.settings.notifications,
            display: sellerData.settings.display,
            security: sellerData.settings.security,
            customSite: {
              theme: sellerData.settings.customSite?.theme ?? 'default',
              primaryColor: sellerData.settings.customSite?.primaryColor ?? '#000000',
              logo: null,
              bannerImage: null,
            },
          })
          setPointsBalance(sellerData.pointsBalance)
          setLogoPreview(sellerData.logo || null)
          setBannerPreview(sellerData.settings.customSite?.bannerImage || null)
          if (sellerData.freeTrialActive && sellerData.freeTrialEndDate) {
            const now = new Date()
            const endDate = new Date(sellerData.freeTrialEndDate)
            const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 3600 * 24))
            setTrialDaysRemaining(daysRemaining > 0 ? daysRemaining : 0)
          }
        } else {
          throw new Error(response.message || t('errors.fetchDescription'))
        }
      } catch (error) {
        toast({
          title: t('errors.fetchTitle'),
          description: error instanceof Error ? error.message : t('errors.fetchDescription'),
          variant: 'destructive',
        })
      } finally {
        setIsFetching(false)
      }
    }
    fetchSettings()
  }, [form, toast, t, router])

  // استطلاع تحديثات النقاط في الوقت الفعلي
  useEffect(() => {
    const interval = setInterval(async () => {
      const session = await fetch('/api/auth/session').then((res) => res.json())
      if (session?.user?.id) {
        const response = await getSellerByUserId(session.user.id)
        if (response.success && response.data) {
          setPointsBalance(response.data.pointsBalance)
        }
      }
    }, 60000) // تحديث كل دقيقة
    return () => clearInterval(interval)
  }, [])

  // معالجة رفع الصور (شعار أو بانر)
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'banner') => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: t('errors.fileSizeTitle'),
          description: t('errors.fileSizeDescription', { size: '2MB' }),
          variant: 'destructive',
        })
        return
      }
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        toast({
          title: t('errors.fileTypeTitle'),
          description: t('errors.fileTypeDescription'),
          variant: 'destructive',
        })
        return
      }

      const reader = new FileReader()
      reader.onloadend = () => {
        if (type === 'logo') {
          setLogoPreview(reader.result as string)
        } else {
          setBannerPreview(reader.result as string)
        }
      }
      reader.onerror = () => {
        toast({
          title: t('errors.fileReadTitle'),
          description: t('errors.fileReadDescription'),
          variant: 'destructive',
        })
      }
      reader.readAsDataURL(file)
    } catch (error) {
      toast({
        title: t('errors.uploadTitle'),
        description: t('errors.uploadDescription'),
        variant: 'destructive',
      })
    }
  }

  // معالجة إرسال النموذج
  const handleSubmit = async (data: SettingsFormValues) => {
    setIsLoading(true)
    try {
      const session = await fetch('/api/auth/session').then((res) => res.json())
      if (!session?.user?.id) {
        throw new Error(t('errors.unauthorizedDescription'))
      }

      const logoFile = data.customSite.logo?.[0]
      const bannerFile = data.customSite.bannerImage?.[0]
      const settings = {
        businessName: data.businessName,
        description: data.description,
        phone: data.phone,
        address: data.address,
        bankInfo: showBankInfo ? data.bankInfo : undefined, // إرسال bankInfo فقط إذا كانت مرئية
        notifications: data.notifications,
        display: data.display,
        security: data.security,
        customSite: {
          theme: data.customSite.theme,
          primaryColor: data.customSite.primaryColor,
          bannerImage: bannerFile ? undefined : data.customSite.bannerImage,
        },
      }

      const formData = new FormData()
      if (logoFile) formData.append('logo', logoFile)
      if (bannerFile) formData.append('bannerImage', bannerFile)

      const result = await updateSellerSettings(settings, formData)
      if (!result.success) {
        throw new Error(result.message || t('errors.submitDescription'))
      }

      toast({
        title: t('success.title'),
        description: t('success.description'),
      })
      form.reset(data)
    } catch (error) {
      toast({
        title: t('errors.submitTitle'),
        description: error instanceof Error ? error.message : t('errors.submitDescription'),
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  // معالجة ترقية الاشتراك
  const handleUpgradeSubscription = async (plan: 'Basic' | 'Pro' | 'VIP') => {
    try {
      const response = await updateSellerSubscription(seller.userId, plan, 0, undefined, undefined)
      if (response.success) {
        toast({
          title: t('success.title'),
          description: t('success.subscriptionUpgraded', { plan }),
        })
        router.refresh() // تحديث الصفحة لعكس التغييرات
      } else {
        throw new Error(response.error || t('errors.submitDescription'))
      }
    } catch (error) {
      toast({
        title: t('errors.submitTitle'),
        description: error instanceof Error ? error.message : t('errors.submitDescription'),
        variant: 'destructive',
      })
    }
  }

  // عرض حالة التحميل
  if (isFetching) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <Card className="max-w-4xl mx-auto my-8">
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        {/* حالة الفترة التجريبية */}
        {seller.freeTrialActive && (
          <div className="mt-4 p-4 bg-blue-100 rounded-lg">
            <p className="text-sm font-semibold">
              {t('trialStatus', { days: trialDaysRemaining })}
            </p>
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
        {/* رصيد النقاط */}
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
                              const value = e.target.value.replace(/[^\d+()-\s]/g, '')
                              field.onChange(value)
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
                              const value = e.target.value.toUpperCase()
                              field.onChange(value)
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
                                const value = e.target.value.toUpperCase()
                                field.onChange(value)
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
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                                onChange(e.target.files)
                                handleImageUpload(e, 'logo')
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
                                onChange(e.target.files)
                                handleImageUpload(e, 'banner')
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
  )
}
