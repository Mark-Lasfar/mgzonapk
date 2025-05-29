'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useTranslations, useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  EyeIcon,
  EyeOffIcon,
  AlertCircle,
  InfoIcon,
  Upload,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

const createSellerFormSchema = (t: any) => {
  return z.object({
    businessName: z.string()
      .min(2, t('validation.businessName.min', { count: 2 }))
      .max(100, t('validation.businessName.max', { count: 100 })),
    email: z.string()
      .email(t('validation.email.invalid'))
      .min(5, t('validation.email.min', { count: 5 }))
      .max(100, t('validation.email.max', { count: 100 })),
    phone: z.string()
      .min(10, t('validation.phone.min', { count: 10 }))
      .max(20, t('validation.phone.max', { count: 20 }))
      .regex(/^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/, t('validation.phone.format')),
    description: z.string()
      .min(50, t('validation.description.min', { count: 50 }))
      .max(500, t('validation.description.max', { count: 500 })),
    businessType: z.enum(['individual', 'company'], {
      required_error: t('validation.businessType.required'),
    }),
    vatRegistered: z.boolean().default(false),
    preferredWarehouseProvider: z.enum(['ShipBob', '4PX'], {
      required_error: t('validation.warehouseProvider.required'),
    }),
    logo: z.any()
      .refine(
        (files) => files?.length == 0 || files?.[0]?.size <= MAX_FILE_SIZE,
        t('validation.logo.size', { size: '5MB' })
      )
      .refine(
        (files) => files?.length == 0 || ACCEPTED_IMAGE_TYPES.includes(files?.[0]?.type),
        t('validation.logo.format')
      )
      .optional(),
    address: z.object({
      street: z.string().min(1, t('validation.address.street.required')),
      city: z.string().min(1, t('validation.address.city.required')),
      state: z.string().min(1, t('validation.address.state.required')),
      country: z.string().min(1, t('validation.address.country.required')),
      postalCode: z.string()
        .min(1, t('validation.address.postalCode.required'))
        .regex(/^[0-9A-Z\s-]*$/, t('validation.address.postalCode.format')),
    }),
    taxId: z.string()
      .min(1, t('validation.taxId.required'))
      .regex(/^[0-9A-Z-]*$/, t('validation.taxId.format')),
    bankInfo: z.object({
      accountName: z.string()
        .min(2, t('validation.bankInfo.accountName.min', { count: 2 }))
        .max(100, t('validation.bankInfo.accountName.max', { count: 100 })),
      accountNumber: z.string()
        .min(8, t('validation.bankInfo.accountNumber.min', { count: 8 }))
        .max(34, t('validation.bankInfo.accountNumber.max', { count: 34 }))
        .regex(/^[0-9]*$/, t('validation.bankInfo.accountNumber.format')),
      bankName: z.string()
        .min(2, t('validation.bankInfo.bankName.min', { count: 2 }))
        .max(100, t('validation.bankInfo.bankName.max', { count: 100 })),
      swiftCode: z.string()
        .min(8, t('validation.bankInfo.swiftCode.min', { count: 8 }))
        .max(11, t('validation.bankInfo.swiftCode.max', { count: 11 }))
        .regex(/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/, t('validation.bankInfo.swiftCode.format')),
    }),
    termsAccepted: z.boolean()
      .refine((val) => val === true, t('validation.terms')),
  });
};

type SellerFormValues = z.infer<ReturnType<typeof createSellerFormSchema>>;

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const calculateProgress = (values: SellerFormValues) => {
  const totalFields = Object.keys(createSellerFormSchema(() => '').shape).length;
  const filledFields = Object.entries(values).filter(([_, value]) =>
    value !== undefined && value !== '' && value !== false
  ).length;
  return Math.round((filledFields / totalFields) * 100);
};

export default function SellerRegistration() {
  const t = useTranslations('SellerRegistration');
  const locale = useLocale();
  const { toast } = useToast();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showAccountNumber, setShowAccountNumber] = useState(false);
  const [formData, setFormData] = useState<SellerFormValues | null>(null);
  const [uploadedLogo, setUploadedLogo] = useState<string | null>(null);
  const [formProgress, setFormProgress] = useState(0);

  const sellerFormSchema = createSellerFormSchema(t);

  const form = useForm<SellerFormValues>({
    resolver: zodResolver(sellerFormSchema),
    defaultValues: {
      businessName: '',
      email: '',
      phone: '',
      description: '',
      businessType: 'individual',
      vatRegistered: false,
      preferredWarehouseProvider: 'ShipBob',
      address: {
        street: '',
        city: '',
        state: '',
        country: '',
        postalCode: '',
      },
      taxId: '',
      bankInfo: {
        accountName: '',
        accountNumber: '',
        bankName: '',
        swiftCode: '',
      },
      termsAccepted: false,
    },
  });

  useEffect(() => {
    const savedData = localStorage.getItem('sellerFormData');
    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData);
        form.reset(parsedData);
      } catch (error) {
        console.error('Error loading saved form data:', error);
      }
    }
  }, []);

  useEffect(() => {
    const subscription = form.watch((value) => {
      localStorage.setItem('sellerFormData', JSON.stringify(value));
      setFormProgress(calculateProgress(value as SellerFormValues));
    });
    return () => subscription.unsubscribe();
  }, [form.watch]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);

      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: t('errors.fileSizeTitle'),
          description: t('errors.fileSizeDescription', {
            size: formatFileSize(MAX_FILE_SIZE),
          }),
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
        setUploadedLogo(reader.result as string);
        toast({
          description: t('logo.uploadSuccess'),
        });
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
      console.error('File upload error:', error);
      toast({
        title: t('errors.uploadTitle'),
        description: t('errors.uploadDescription'),
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleClearLogo = () => {
    setUploadedLogo(null);
    form.setValue('logo', null);
    toast({
      description: t('logo.cleared'),
    });
  };

  const handlePreview = async (data: SellerFormValues) => {
    if (data.businessType === 'individual' && data.preferredWarehouseProvider === '4PX') {
      toast({
        variant: 'destructive',
        description: t('errors.warehouseIncompatible'),
      });
      return;
    }
    setFormData(data);
    setShowPreview(true);
  };

  const handleSubmit = async () => {
    if (!formData) return;
    let retries = 0;

    const attemptSubmission = async (): Promise<boolean> => {
      try {
        setLoading(true);

        const formDataToSend = new FormData();
        formDataToSend.append('data', JSON.stringify(formData));
        if (form.watch('logo')?.[0]) {
          formDataToSend.append('logo', form.watch('logo')[0]);
        }

        const response = await fetch('/api/seller/registration', {
          method: 'POST',
          body: formDataToSend,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
          toast({
            title: t('success.title'),
            description: t('success.description'),
          });

          localStorage.removeItem('sellerFormData');
          await fetch('/api/auth/session', { method: 'GET' });
          await new Promise(resolve => setTimeout(resolve, 1000));
          router.push('/seller/dashboard');
          router.refresh();
          return true;
        }

        throw new Error(result.message || t('errors.registrationFailed'));
      } catch (error) {
        if (retries < MAX_RETRIES) {
          retries++;
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * retries));
          return attemptSubmission();
        }

        toast({
          title: t('errors.submissionTitle'),
          description: error instanceof Error ? error.message : t('errors.submissionDescription'),
          variant: 'destructive',
        });
        return false;
      }
    };

    try {
      const success = await attemptSubmission();
      if (success) {
        setShowPreview(false);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Card className="max-w-2xl mx-auto my-8">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            {t('title')}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <InfoIcon className="h-5 w-5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t('SellerRegistration.description')}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>

          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{t('progress')}</span>
              <span>{formProgress}%</span>
            </div>
            <Progress value={formProgress} className="h-2" />
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t('alert.title')}</AlertTitle>
            <AlertDescription>
              {t('alert.description')}
            </AlertDescription>
          </Alert>
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handlePreview)} className="space-y-8">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">{t('sections.businessInfo')}</h3>

                <div className="flex items-center space-x-4">
                  <div className="w-24 h-24 border rounded-lg overflow-hidden flex items-center justify-center">
                    {uploadedLogo ? (
                      <img
                        src={uploadedLogo}
                        alt={t('logo.alt')}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Upload className="w-8 h-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1">
                    <FormField
                      control={form.control}
                      name="logo"
                      render={({ field: { value, onChange, ...field } }) => (
                        <FormItem>
                          <FormLabel>{t('logo.label')}</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type="file"
                                accept={ACCEPTED_IMAGE_TYPES.join(',')}
                                onChange={(e) => {
                                  onChange(e.target.files);
                                  handleLogoUpload(e);
                                }}
                                disabled={isUploading}
                                {...field}
                              />
                              {isUploading && (
                                <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                </div>
                              )}
                            </div>
                          </FormControl>
                          <FormDescription>
                            {t('logo.description')}
                          </FormDescription>
                          {uploadedLogo && (
                            <Button
                              variant="destructive"
                              size="sm"
                              className="mt-2"
                              onClick={handleClearLogo}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {t('logo.clear')}
                            </Button>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

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
                        <Input type="email" placeholder={t('email.placeholder')} {...field} />
                      </FormControl>
                      <FormDescription>{t('email.description')}</FormDescription>
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
                        <Input placeholder={t('phone.placeholder')} {...field} />
                      </FormControl>
                      <FormDescription>{t('phone.description')}</FormDescription>
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
                        <Textarea placeholder={t('description.placeholder')} {...field} />
                      </FormControl>
                      <FormDescription>{t('description.description')}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="businessType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('businessType.label')}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('businessType.placeholder')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="individual">{t('businessType.individual')}</SelectItem>
                          <SelectItem value="company">{t('businessType.company')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>{t('businessType.description')}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="vatRegistered"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>{t('vatRegistered.label')}</FormLabel>
                        <FormDescription>{t('vatRegistered.description')}</FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">{t('sections.warehouseInfo')}</h3>

                <FormField
                  control={form.control}
                  name="preferredWarehouseProvider"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('warehouseProvider.label')}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('warehouseProvider.placeholder')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="ShipBob">ShipBob</SelectItem>
                          <SelectItem value="4PX">4PX</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>{t('warehouseProvider.description')}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">{t('sections.addressInfo')}</h3>

                <FormField
                  control={form.control}
                  name="address.street"
                  render={({ field }) => (
                    <FormItem>
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
                        <Input placeholder={t('address.postalCode.placeholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">{t('sections.taxInfo')}</h3>

                <FormField
                  control={form.control}
                  name="taxId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('taxId.label')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('taxId.placeholder')} {...field} />
                      </FormControl>
                      <FormDescription>{t('taxId.description')}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">{t('sections.bankInfo')}</h3>

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
                        <div className="relative">
                          <Input
                            type={showAccountNumber ? 'text' : 'password'}
                            placeholder={t('bankInfo.accountNumber.placeholder')}
                            {...field}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3"
                            onClick={() => setShowAccountNumber(!showAccountNumber)}
                          >
                            {showAccountNumber ? (
                              <EyeOffIcon className="h-4 w-4" />
                            ) : (
                              <EyeIcon className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
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
                        <Input placeholder={t('bankInfo.swiftCode.placeholder')} {...field} />
                      </FormControl>
                      <FormDescription>{t('bankInfo.swiftCode.description')}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">{t('sections.terms')}</h3>

                <FormField
                  control={form.control}
                  name="termsAccepted"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>{t('terms.label')}</FormLabel>
                        <FormDescription>
                          {t('terms.description')}
                        </FormDescription>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    form.reset();
                    localStorage.removeItem('sellerFormData');
                    setUploadedLogo(null);
                    toast({
                      description: t('formReset'),
                    });
                  }}
                >
                  {t('reset')}
                </Button>
                <Button type="submit" disabled={loading || isUploading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('submitting')}
                    </>
                  ) : (
                    t('preview')
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('preview.title')}</DialogTitle>
            <DialogDescription>
              {t('preview.description')}
            </DialogDescription>
          </DialogHeader>

          {formData && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t('sections.businessInfo')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {uploadedLogo && (
                    <img
                      src={uploadedLogo}
                      alt={t('logo.alt')}
                      className="w-24 h-24 object-cover rounded-lg mb-4"
                    />
                  )}
                  <p><strong>{t('businessName.label')}:</strong> {formData.businessName}</p>
                  <p><strong>{t('email.label')}:</strong> {formData.email}</p>
                  <p><strong>{t('phone.label')}:</strong> {formData.phone}</p>
                  <p><strong>{t('description.label')}:</strong> {formData.description}</p>
                  <p><strong>{t('businessType.label')}:</strong> {t(`businessType.${formData.businessType}`)}</p>
                  <p><strong>{t('vatRegistered.label')}:</strong> {formData.vatRegistered ? t('yes') : t('no')}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t('sections.warehouseInfo')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p><strong>{t('warehouseProvider.label')}:</strong> {formData.preferredWarehouseProvider}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t('sections.addressInfo')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p><strong>{t('address.street.label')}:</strong> {formData.address.street}</p>
                  <p><strong>{t('address.city.label')}:</strong> {formData.address.city}</p>
                  <p><strong>{t('address.state.label')}:</strong> {formData.address.state}</p>
                  <p><strong>{t('address.country.label')}:</strong> {formData.address.country}</p>
                  <p><strong>{t('address.postalCode.label')}:</strong> {formData.address.postalCode}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t('sections.taxInfo')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p><strong>{t('taxId.label')}:</strong> {formData.taxId}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t('sections.bankInfo')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p><strong>{t('bankInfo.accountName.label')}:</strong> {formData.bankInfo.accountName}</p>
                  <p><strong>{t('bankInfo.accountNumber.label')}:</strong> {formData.bankInfo.accountNumber}</p>
                  <p><strong>{t('bankInfo.bankName.label')}:</strong> {formData.bankInfo.bankName}</p>
                  <p><strong>{t('bankInfo.swiftCode.label')}:</strong> {formData.bankInfo.swiftCode}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t('sections.terms')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p><strong>{t('terms.label')}:</strong> {formData.termsAccepted ? t('accepted') : t('notAccepted')}</p>
                </CardContent>
              </Card>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPreview(false)}
            >
              {t('preview.edit')}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('submitting')}
                </>
              ) : (
                t('preview.submit')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}