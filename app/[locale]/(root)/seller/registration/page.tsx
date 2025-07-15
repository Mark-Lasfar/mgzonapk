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
import { Loader2, AlertCircle, InfoIcon, Upload, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { countries } from 'countries-list';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Image from 'next/image';
import Link from 'next/link';
import { getSetting } from '@/lib/actions/setting.actions';

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const createSellerFormSchema = (
  t: (key: string, options?: Record<string, any>) => string
) =>
  z
    .object({
      businessName: z
        .string()
        .min(2, t('validation business name min', { count: 2 }))
        .max(100, t('validation business name max', { count: 100 }))
        .regex(/^[\p{L}\p{N}\s.,!?&()-]+$/u, t('validation business name format')),
      email: z
        .string()
        .email(t('validation email invalid'))
        .min(5, t('validation email min', { count: 5 }))
        .max(100, t('validation email max', { count: 100 })),
      phone: z
        .string()
        .min(10, t('validation phone min', { count: 10 }))
        .max(20, t('validation phone max', { count: 20 }))
        .regex(/^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/, t('validation phone format')),
      description: z
        .string()
        .min(10, t('validation description min', { count: 10 }))
        .max(500, t('validation description max', { count: 500 }))
        .regex(/^[\p{L}\p{N}\s.,!?&()-]+$/u, t('validation description format')),
      businessType: z.enum(['individual', 'company'], {
        required_error: t('validation business type required'),
      }),
      vatRegistered: z.boolean().optional(),
taxId: z
  .string()
  .min(5, { message: 'validation tax id min' })
  .regex(/^[0-9A-Z-]*$/, { message: 'validation tax id format' })
  .optional()
  .transform((val) => (val === '' ? undefined : val)), // تحويل السلسلة الفارغة إلى undefined
      logo: z.string().optional().nullable(),
address: z.object({
  street: z.string().min(1, { message: 'validation address street required' }),
  city: z.string().min(1, { message: 'validation address city required' }),
  state: z.string().min(1, { message: 'validation address state required' }),
  countryCode: z.string().min(2, { message: 'validation address country required' }),
  postalCode: z
    .string()
    .min(1, { message: 'validation address postal code required' })
    .regex(/^[0-9A-Z\s-]*$/, { message: 'validation address postal code format' }),
}),
      termsAccepted: z
        .boolean()
        .refine((val) => val === true, t('validation terms required')),
      is_trial: z.boolean().default(true),
    })
    .refine(
      (data) => data.businessType !== 'company' || (data.taxId && data.taxId.length > 0),
      { message: t('validation tax id required'), path: ['taxId'] }
    );

type SellerFormValues = z.infer<ReturnType<typeof createSellerFormSchema>>;

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const calculateProgress = (
  values: SellerFormValues,
  currentStep: number
): number => {
  const stepsFields: (keyof SellerFormValues)[][] = [
    ['businessName', 'email', 'logo'],
    ['phone', 'description', 'businessType'],
    ['address', 'taxId', 'vatRegistered'],
    ['termsAccepted'],
  ];
  const relevantFields = stepsFields.slice(0, currentStep + 1).flat();
  const totalFields = relevantFields.length;
  const filledFields = relevantFields.filter((key) => {
    const value = values[key];
    if (key === 'address' && value) {
      return Object.values(value).some((v) => v !== '' && v !== undefined);
    }
    if (key === 'taxId' && values.businessType !== 'company') return true;
    return value !== undefined && value !== '' && value !== false;
  }).length;
  return Math.round((filledFields / totalFields) * 100);
};

export default function SellerRegistration() {
  const t = useTranslations('Seller Registration');
  const locale = useLocale();
  const { toast } = useToast();
  // const { site } =  getSetting();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [site, setSite] = useState<{ name: string; logo: string } | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [formData, setFormData] = useState<SellerFormValues | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
  const [formProgress, setFormProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  
  const [businessType, setBusinessType] = useState<'individual' | 'company'>(
    'individual'
  );

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
      taxId: '',
      address: {
        street: '',
        city: '',
        state: '',
        countryCode: '',
        postalCode: '',
      },
      termsAccepted: false,
      is_trial: true,
    },
  });

  useEffect(() => {
    const savedData = localStorage.getItem('sellerFormData');
    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData) as SellerFormValues;
        form.reset(parsedData);
        setBusinessType(parsedData.businessType || 'individual');
        setFormProgress(calculateProgress(parsedData, currentStep));
      } catch (error) {
        console.error('Error loading saved form data:', error);
        toast({
          title: t('errors load form title'),
          description: t('errors load form description'),
          variant: 'destructive',
        });
      }
    }
  }, [form, currentStep, t]);


useEffect(() => {
  const fetchSettings = async () => {
    try {
      const { site } = await getSetting();
      setSite(site);
    } catch (error) {
      console.error('Error fetching site settings:', error);
      toast({
        title: 'خطأ في تحميل إعدادات الموقع',
        description: 'حدث خطأ أثناء تحميل إعدادات الموقع. حاول مرة أخرى.',
        variant: 'destructive',
      });
    }
  };

  fetchSettings();
}, []);


  useEffect(() => {
    const subscription = form.watch((value) => {
      localStorage.setItem('sellerFormData', JSON.stringify(value));
      setFormProgress(calculateProgress(value as SellerFormValues, currentStep));
      setBusinessType(value.businessType || 'individual');
    });
    return () => subscription.unsubscribe();
  }, [form, currentStep]);

const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) {
    console.log('No file selected');
    toast({
      title: t('errors.no file title'),
      description: t('errors.no file description'),
      variant: 'destructive',
    });
    return;
  }

  try {
    setIsUploading(true);

    console.log('Selected file:', {
      name: file.name,
      type: file.type,
      size: file.size,
    });

    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: t('errors.file size title'),
        description: t('errors.file size description', {
          size: formatFileSize(MAX_FILE_SIZE),
        }),
        variant: 'destructive',
      });
      return;
    }

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast({
        title: t('errors.file type title'),
        description: t('errors.file type description'),
        variant: 'destructive',
      });
      return;
    }

    setSelectedLogoFile(file);
    const previewUrl = URL.createObjectURL(file);
    setLogoPreview(previewUrl);
    form.setValue('logo', previewUrl, { shouldValidate: true, shouldDirty: true });

    toast({
      description: t('logo upload success'),
    });
  } catch (error) {
    console.error('File upload error:', error);
    toast({
      title: t('errors.upload title'),
      description: t('errors.upload description'),
      variant: 'destructive',
    });
  } finally {
    setIsUploading(false);
  }
};

const handleClearLogo = () => {
  setLogoPreview(null);
  setSelectedLogoFile(null);
  form.setValue('logo', null, { shouldValidate: true, shouldDirty: true });
  toast({
    description: t('logo clear'),
  });
};
  const handleNextStep = async () => {
    const fieldsToValidate: (keyof SellerFormValues)[][] = [
      ['businessName', 'email', 'logo'],
      ['phone', 'description', 'businessType'],
      ['address', 'vatRegistered'],
      ['termsAccepted'],
    ];

    if (form.getValues('businessType') === 'company') {
      fieldsToValidate[2].push('taxId');
    }

    const isValid = await form.trigger(fieldsToValidate[currentStep]);
    if (isValid) {
      if (currentStep < 3) {
        setCurrentStep(currentStep + 1);
      } else {
        const data = form.getValues();
        setFormData(data);
        setShowPreview(true);
      }
    } else {
      console.log('Validation errors:', form.formState.errors);
      toast({
        title: t('validation error title'),
        description: t('validation error description'),
        variant: 'destructive',
      });
    }
  };

  const handlePreviousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

const handleSubmit = async () => {
  if (!formData) return;

  try {
    setLoading(true);

    const formDataToSend = new FormData();
    const dataToSend = {
      ...formData,
      address: {
        street: formData.address.street,
        city: formData.address.city,
        state: formData.address.state,
        countryCode: formData.address.countryCode,
        postalCode: formData.address.postalCode,
      },
    };

    if (dataToSend.businessType === 'individual') {
      delete dataToSend.taxId;
    }
    delete dataToSend.logo; // إزالة logo من dataToSend

    formDataToSend.append('data', JSON.stringify(dataToSend));

    if (selectedLogoFile) {
      formDataToSend.append('logo', selectedLogoFile);
    }

    console.log('FormData contents:', Array.from(formDataToSend.entries()));

    const response = await fetch('/api/seller/registration', {
      method: 'POST',
      body: formDataToSend,
    });

    const result = await response.json();
    if (!result.success) {
      const errorMessage = result.error || result.message || t('errors.submission description');
      toast({
        title: t('errors.submission title'),
        description: errorMessage,
        variant: 'destructive',
      });
      throw new Error(errorMessage);
    }

    setLogoPreview(null);
    setSelectedLogoFile(null);
    localStorage.removeItem('sellerFormData');
    router.push(result.data.redirect || '/seller/dashboard');
  } catch (error) {
    console.error('Submission error:', error);
    toast({
      title: t('errors.submission title'),
      description: t('errors.submission description'),
      variant: 'destructive',
    });
  } finally {
    setLoading(false);
    setShowPreview(false);
  }
};

  const countryOptions = Object.entries(countries).map(([code, country]) => ({
    value: code,
    label: country.name,
  }));

  const steps = [
    t('steps basic info'),
    t('steps contact info'),
    t('steps address tax info'),
    t('steps terms'),
  ];

  return (

    
    <>


  {site && (
    <div className="flex justify-center my-4">
      <Image
        src={site.logo}
        width={80}
        height={80}
        alt={`${site.name} logo`}
        className="animate-slow-spin rounded-full"
        style={{ maxWidth: '100%', height: 'auto' }}
      />
    </div>
  )}




      <Card
        className="max-w-2xl mx-auto my-8"
        dir={locale === 'ar-SA' ? 'rtl' : 'ltr'}
      >
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            {t('title')}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <InfoIcon className="h-5 w-5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t('description description')}</p>
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

          <Tabs value={currentStep.toString()} className="mt-4">
            <TabsList className="grid w-full grid-cols-4">
              {steps.map((step, index) => (
                <TabsTrigger
                  key={index}
                  value={index.toString()}
                  disabled={index > currentStep}
                >
                  {step}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="mt-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{t('alert title')}</AlertTitle>
              <AlertDescription>{t('alert description')}</AlertDescription>
            </Alert>
          </div>
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form onSubmit={(e) => e.preventDefault()} className="space-y-8">
              {currentStep === 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">
                    {t('sections basic info')}
                  </h3>

                  <div className="flex items-center space-x-4">
                    <div className="w-24 h-24 border rounded-lg overflow-hidden flex items-center justify-center">
<div className="w-24 h-24 border rounded-lg overflow-hidden flex items-center justify-center">
  {logoPreview ? (
    <Image
      src={logoPreview}
      alt={t('logo alt')}
      width={96}
      height={96}
      className="w-full h-full object-cover"
      // layout="fixed"
      priority
    />
  ) : (
    <Upload className="w-8 h-8 text-muted-foreground" />
  )}
</div>
                    </div>
                    <div className="flex-1">
                      <FormField
                        control={form.control}
                        name="logo"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('logo label')}</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  type="file"
                                  accept={ACCEPTED_IMAGE_TYPES.join(',')}
                                  onChange={(e) => handleLogoUpload(e)}
                                  disabled={isUploading}
                                  onBlur={field.onBlur}
                                  name={field.name}
                                  ref={field.ref}
                                />
                                {isUploading && (
                                  <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  </div>
                                )}
                              </div>
                            </FormControl>
                            <FormDescription>{t('logo description')}</FormDescription>
                            {logoPreview && (
                              <Button
                                variant="destructive"
                                size="sm"
                                className="mt-2"
                                onClick={handleClearLogo}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                {t('logo clear')}
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
                        <FormLabel>{t('business name label')}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t('business name placeholder')}
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          {t('business name description')}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('email label')}</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder={t('email placeholder')}
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>{t('email description')}</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {currentStep === 1 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">
                    {t('sections contact info')}
                  </h3>

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('phone label')}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t('phone placeholder')}
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>{t('phone description')}</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('description label')}</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder={t('description placeholder')}
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          {t('description description')}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="businessType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('business type label')}</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue
                                placeholder={t('business type placeholder')}
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="individual">
                              {t('business type individual')}
                            </SelectItem>
                            <SelectItem value="company">
                              {t('business type company')}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          {t('business type description')}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">
                    {t('sections address tax info')}
                  </h3>

                  <FormField
                    control={form.control}
                    name="address.street"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('address street label')}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t('address street placeholder')}
                            {...field}
                          />
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
                        <FormLabel>{t('address city label')}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t('address city placeholder')}
                            {...field}
                          />
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
                        <FormLabel>{t('address state label')}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t('address state placeholder')}
                            {...field}
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
                        <FormLabel>{t('address country label')}</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue
                                placeholder={t('address country placeholder')}
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {countryOptions.map((country) => (
                              <SelectItem
                                key={country.value}
                                value={country.value}
                              >
                                {country.label}
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
                    name="address.postalCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('address postal code label')}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t('address postal code placeholder')}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {businessType === 'company' && (
                    <>
                      <FormField
                        control={form.control}
                        name="taxId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('tax id label')}</FormLabel>
                            <FormControl>
                              <Input
                                placeholder={t('tax id placeholder')}
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              {t('tax id description')}
                            </FormDescription>
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
                              <FormLabel>{t('vat registered label')}</FormLabel>
                              <FormDescription>
                                {t('vat registered description')}
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />
                    </>
                  )}
                </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">
                    {t('sections terms')}
                  </h3>

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
                          <FormLabel>{t('terms label')}</FormLabel>
                          <FormDescription>
                            {t.rich('terms description', {
                              terms: (chunks) => (
                                <Link href="/terms" className="underline">
                                  {chunks}
                                </Link>
                              ),
                              privacy: (chunks) => (
                                <Link href="/privacy" className="underline">
                                  {chunks}
                                </Link>
                              ),
                            })}
                          </FormDescription>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              <div className="flex justify-between gap-4">
                {currentStep > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePreviousStep}
                  >
                    {t('previous')}
                  </Button>
                )}
                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      form.reset();
                      localStorage.removeItem('sellerFormData');
                      setLogoPreview(null);
                      setSelectedLogoFile(null);
                      setBusinessType('individual');
                      setCurrentStep(0);
                      toast({
                        description: t('form reset'),
                      });
                    }}
                  >
                    {t('reset')}
                  </Button>
                  <Button
                    type="button"
                    onClick={handleNextStep}
                    disabled={loading || isUploading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('submitting')}
                      </>
                    ) : currentStep === 3 ? (
                      t('preview')
                    ) : (
                      t('next')
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-full sm:max-w-2xl h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('preview title')}</DialogTitle>
            <DialogDescription>{t('preview description')}</DialogDescription>
          </DialogHeader>

          <div className="relative">
            <div className="sticky top-0 bg-background z-10">
              <div className="flex gap-2 mb-4">
                {steps.map((step, index) => (
                  <Button
                    key={index}
                    variant={currentStep === index ? 'default' : 'outline'}
                    onClick={() => setCurrentStep(index)}
                    className="flex-1"
                  >
                    {step}
                  </Button>
                ))}
              </div>
            </div>

            {formData && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>{t('sections basic info')}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
{logoPreview && (
  <div className="flex justify-center mb-4 relative w-24 h-24">
    <svg
      className="absolute top-0 left-0 w-full h-full"
      viewBox="0 0 100 100"
    >
      <circle
        cx="50"
        cy="50"
        r="48"
        stroke="#4a90e2"
        strokeWidth="3"
        fill="none"
        className="animate-draw"
      />
    </svg>
    <Image
      src={logoPreview}
      alt={t('logo alt')}
      width={96}
      height={96}
      className="rounded-full animate-initial-spin"
      style={{ maxWidth: '100%', height: 'auto' }}
    />
  </div>
)}


                    <p>
                      <strong>{t('business name label')}:</strong>{' '}
                      {formData.businessName}
                    </p>
                    <p>
                      <strong>{t('email label')}:</strong> {formData.email}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>{t('sections contact info')}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p>
                      <strong>{t('phone label')}:</strong> {formData.phone}
                    </p>
                    <p>
                      <strong>{t('description label')}:</strong>{' '}
                      {formData.description}
                    </p>
                    <p>
                      <strong>{t('business type label')}:</strong>{' '}
                      {t(`business type ${formData.businessType}`)}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>{t('sections address tax info')}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p>
                      <strong>{t('address street label')}:</strong>{' '}
                      {formData.address.street}
                    </p>
                    <p>
                      <strong>{t('address city label')}:</strong>{' '}
                      {formData.address.city}
                    </p>
                    <p>
                      <strong>{t('address state label')}:</strong>{' '}
                      {formData.address.state}
                    </p>
                    <p>
                      <strong>{t('address country label')}:</strong>{' '}
                      {countries[formData.address.countryCode as keyof typeof countries]?.name ||
                        formData.address.countryCode}
                    </p>
                    <p>
                      <strong>{t('address postal code label')}:</strong>{' '}
                      {formData.address.postalCode}
                    </p>
                    {formData.businessType === 'company' && (
                      <>
                        <p>
                          <strong>{t('tax id label')}:</strong>{' '}
                          {formData.taxId || t('not provided')}
                        </p>
                        <p>
                          <strong>{t('vat registered label')}:</strong>{' '}
                          {formData.vatRegistered ? t('yes') : t('no')}
                        </p>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>{t('sections terms')}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p>
                      <strong>{t('terms label')}:</strong>{' '}
                      {formData.termsAccepted ? t('accepted') : t('not accepted')}
                    </p>
                    <p>
                      <strong>{t('trial status label')}:</strong>{' '}
                      {formData.is_trial ? t('trial active') : t('trial inactive')}
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>

          <DialogFooter className="sticky bottom-0 bg-background pt-4">
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              {t('preview edit')}
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('submitting')}
                </>
              ) : (
                t('preview submit')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}