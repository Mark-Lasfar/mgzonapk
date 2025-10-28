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
import { useToast } from '@/components/ui/toast';
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
import PhoneInput from 'react-phone-number-input';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import 'react-phone-number-input/style.css';
import CryptoJS from 'crypto-js';


const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// قواعد طول رقم الهاتف حسب الدولة
const phoneLengthRules: Record<string, { min: number; max: number }> = {
  EG: { min: 10, max: 11 }, // مصر: 10 أو 11 رقم بعد +20
  US: { min: 10, max: 10 }, // أمريكا: 10 أرقام بعد +1
  GB: { min: 10, max: 11 }, // بريطانيا: 10-11 رقم
  // أضف المزيد من الدول حسب الحاجة
  default: { min: 6, max: 15 }, // قاعدة عامة
};

// قواعد التحقق من الرقم الضريبي حسب الدولة
const taxIdRules: Record<string, RegExp> = {
  EG: /^\d{9}$/, // مصر: 9 أرقام
  US: /^\d{2}-\d{7}$/, // أمريكا: XX-XXXXXXX
  GB: /^[A-Z0-9]{9,12}$/, // بريطانيا: 9-12 حرف/رقم
  default: /^[0-9A-Z-]{5,20}$/, // قاعدة عامة
};

// قواعد التحقق من الرمز البريدي حسب الدولة
const postalCodeRules: Record<string, RegExp> = {
  EG: /^\d{5}$/, // مصر: 5 أرقام
  US: /^\d{5}(-\d{4})?$/, // أمريكا: 5 أو 9 أرقام
  GB: /^[A-Z]{1,2}\d{1,2} ?[A-Z0-9]{3}$/, // بريطانيا: صيغة معقدة
  default: /^[0-9A-Z\s-]{3,10}$/, // قاعدة عامة
};

const createSellerFormSchema = (
  t: (key: string, options?: Record<string, any>) => string,
  step: number,
  selectedCountry: string
) =>
  z
    .object({
      businessName:
        step >= 0
          ? z
              .string()
              .min(2, t('validation business name min', { count: 2 }))
              .max(100, t('validation business name max', { count: 100 }))
              .regex(/^[\p{L}\p{N}\s.,!?&()-]+$/u, t('validation business name format'))
          : z.string().optional(),
      email:
        step >= 0
          ? z
              .string()
              .email(t('validation email invalid'))
              .min(5, t('validation email min', { count: 5 }))
              .max(100, t('validation email max', { count: 100 }))
          : z.string().optional(),
      phone:
        step >= 1
          ? z
              .string()
              .min(1, t('validation phone required'))
              .refine(
                (phone) => {
                  if (!phone) return false;
                  const phoneNumber = parsePhoneNumberFromString(phone);
                  if (!phoneNumber) return false;
                  const country = phoneNumber.country || selectedCountry;
                  const rules = phoneLengthRules[country] || phoneLengthRules.default;
                  const numberLength = phoneNumber.nationalNumber.length;
                  return (
                    phoneNumber.isValid() &&
                    numberLength >= rules.min &&
                    numberLength <= rules.max
                  );
                },
                { message: t('validation phone format') }
              )
          : z.string().optional(),
      description:
        step >= 1
          ? z
              .string()
              .min(50, t('validation description min', { count: 50 }))
              .max(500, t('validation description max', { count: 500 }))
              .regex(/^[\p{L}\p{N}\s.,!?&()\n-]+$/u, t('validation description format'))
          : z.string().optional(),
      businessType:
        step >= 1
          ? z.enum(['individual', 'company'], {
              required_error: t('validation business type required'),
            })
          : z.enum(['individual', 'company']).optional(),
      vatRegistered: step >= 2 ? z.boolean().default(false) : z.boolean().optional(),
      taxId:
        step >= 2
          ? z
              .string()
              .optional()
              .transform((val) => (val === '' ? undefined : val))
              .refine(
                (val) => {
                  if (!val) return true;
                  const regex = taxIdRules[selectedCountry] || taxIdRules.default;
                  return regex.test(val);
                },
                { message: t('validation tax id format') }
              )
          : z.string().optional(),
      logo: z.string().url().optional().nullable(),
      address:
        step >= 2
          ? z.object({
              street: z.string().min(1, t('validation address street required')),
              city: z.string().min(1, t('validation address city required')),
              state: z.string().min(1, t('validation address state required')),
              countryCode: z
                .string()
                .min(2, t('validation address country required'))
                .regex(/^[A-Z]{2}$/, t('validation address country format')),
              postalCode: z
                .string()
                .min(1, t('validation address postal code required'))
                .refine(
                  (val) => {
                    const regex = postalCodeRules[selectedCountry] || postalCodeRules.default;
                    return regex.test(val);
                  },
                  { message: t('validation address postal code format') }
                ),
            })
          : z
              .object({
                street: z.string().optional(),
                city: z.string().optional(),
                state: z.string().optional(),
                countryCode: z.string().optional(),
                postalCode: z.string().optional(),
              })
              .optional(),
      termsAccepted:
        step >= 3
          ? z.boolean().refine((val) => val === true, t('validation terms required'))
          : z.boolean().optional(),
      is_trial: z.boolean().default(true),
    })
    .refine(
      (data) => step < 2 || data.businessType !== 'company' || (data.taxId && data.taxId.length > 0),
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
    ['address', 'vatRegistered', 'taxId'],
    ['termsAccepted'],
  ];
  const relevantFields = stepsFields.slice(0, currentStep + 1).flat();
  const totalFields = relevantFields.length;
  const filledFields = relevantFields.filter((key) => {
    const value = values[key];
    if (key === 'address' && value) {
      return Object.values(value).every((v) => v !== '' && v !== undefined);
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
  const [businessType, setBusinessType] = useState<'individual' | 'company'>('individual');
  const [selectedCountry, setSelectedCountry] = useState<string>('');

  const sellerFormSchema = createSellerFormSchema(t, currentStep, selectedCountry);

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
      logo: null,
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
        setSelectedCountry(parsedData.address?.countryCode || '');
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
          title: t('errors site settings title'),
          description: t('errors site settings description'),
          variant: 'destructive',
        });
      }
    };

    fetchSettings();
  }, [t]);

  useEffect(() => {
    const subscription = form.watch((value) => {
      localStorage.setItem('sellerFormData', JSON.stringify(value));
      setFormProgress(calculateProgress(value as SellerFormValues, currentStep));
      setBusinessType(value.businessType || 'individual');
      setSelectedCountry(value.address?.countryCode || '');
      const phoneNumber = value.phone ? parsePhoneNumberFromString(value.phone) : null;
      if (phoneNumber && phoneNumber.country) {
        setSelectedCountry(phoneNumber.country);
      }
    });
    return () => subscription.unsubscribe();
  }, [form, currentStep]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      toast({
        title: t('errors.no file title'),
        description: t('errors.no file description'),
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsUploading(true);

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
      ['address', 'vatRegistered', 'taxId'],
      ['termsAccepted'],
    ];

    const isValid = await form.trigger(fieldsToValidate[currentStep], { shouldFocus: true });

    if (isValid) {
      if (currentStep < 3) {
        setCurrentStep(currentStep + 1);
      } else {
        const fullValidation = await form.trigger();
        if (!fullValidation) {
          console.log('Full validation errors:', form.formState.errors);
          toast({
            title: t('validation error title'),
            description: Object.values(form.formState.errors)
              .map((err) => err.message)
              .filter(Boolean)
              .join(', '),
            variant: 'destructive',
          });
          return;
        }
        const data = form.getValues();
        setFormData(data);
        setShowPreview(true);
      }
    } else {
      console.log('Validation errors:', form.formState.errors);
      toast({
        title: t('validation error title'),
        description: Object.values(form.formState.errors)
          .map((err) => err.message)
          .filter(Boolean)
          .join(', '),
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
    delete dataToSend.logo;

    // تشفير البيانات الحساسة
    const encryptionKey = process.env.NEXT_PUBLIC_ENCRYPTION_KEY;
    if (!encryptionKey) {
      throw new Error('Encryption key is missing');
    }

    // البيانات الحساسة
    const sensitiveData = {
      email: dataToSend.email,
      phone: dataToSend.phone,
      taxId: dataToSend.taxId,
      address: dataToSend.address,
    };

    // تحويل البيانات الحساسة إلى JSON
    const sensitiveDataString = JSON.stringify(sensitiveData);
    console.log('Sensitive data before encryption:', sensitiveDataString);

    // إنشاء IV يدويًا (16 بايت)
    const iv = CryptoJS.lib.WordArray.random(16);
    const key = CryptoJS.enc.Hex.parse(encryptionKey);
    const encryptedSensitiveData = CryptoJS.AES.encrypt(
      sensitiveDataString,
      key,
      { iv: iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
    );

    // تحويل البيانات المشفرة وIV إلى hex
    const encryptedHex = encryptedSensitiveData.ciphertext.toString(CryptoJS.enc.Hex);
    const ivHex = iv.toString(CryptoJS.enc.Hex);

    // دمج IV مع البيانات المشفرة
    const encryptedData = `${ivHex}:${encryptedHex}`;
    console.log('Encrypted data to send:', encryptedData);

    // إضافة البيانات المشفرة مع البيانات غير الحساسة
    formDataToSend.append('data', JSON.stringify({
      ...dataToSend,
      sensitiveData: encryptedData,
    }));

    if (selectedLogoFile) {
      formDataToSend.append('logo', selectedLogoFile);
    }

    console.log('FormData to send:', JSON.stringify(Object.fromEntries(formDataToSend)));

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
    flag: `https://flagcdn.com/16x12/${code.toLowerCase()}.png`,
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

      <Card className="max-w-2xl mx-auto my-8" dir={locale === 'ar-SA' ? 'rtl' : 'ltr'}>
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
                  <h3 className="text-lg font-semibold">{t('sections basic info')}</h3>
                  <div className="flex items-center space-x-4">
                    <div className="w-24 h-24 border rounded-lg overflow-hidden flex items-center justify-center">
                      {logoPreview ? (
                        <Image
                          src={logoPreview}
                          alt={t('logo alt')}
                          width={96}
                          height={96}
                          className="w-full h-full object-cover"
                          priority
                        />
                      ) : (
                        <Upload className="w-8 h-8 text-muted-foreground" />
                      )}
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
                          <Input placeholder={t('business name placeholder')} {...field} />
                        </FormControl>
                        <FormDescription>{t('business name description')}</FormDescription>
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
                          <Input type="email" placeholder={t('email placeholder')} {...field} />
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
                  <h3 className="text-lg font-semibold">{t('sections contact info')}</h3>

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('phone label')}</FormLabel>
                        <FormControl>
                          <PhoneInput
                            international
                            countryCallingCodeEditable={false}
                            defaultCountry={selectedCountry || 'EG'}
                            placeholder={t('phone placeholder')}
                            value={field.value}
                            onChange={(value) => {
                              field.onChange(value || '');
                              const phoneNumber = value ? parsePhoneNumberFromString(value) : null;
                              if (phoneNumber && phoneNumber.country) {
                                setSelectedCountry(phoneNumber.country);
                              }
                            }}
                            onBlur={field.onBlur}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          />
                        </FormControl>
                        <FormDescription>
                          {t('phone description')} {selectedCountry && phoneLengthRules[selectedCountry] ? t(`phone format ${selectedCountry}`, { min: phoneLengthRules[selectedCountry].min, max: phoneLengthRules[selectedCountry].max }) : t('phone format default')}
                        </FormDescription>
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
                          <Textarea placeholder={t('description placeholder')} {...field} />
                        </FormControl>
                        <FormDescription>{t('description description')}</FormDescription>
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
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('business type placeholder')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="individual">{t('business type individual')}</SelectItem>
                            <SelectItem value="company">{t('business type company')}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>{t('business type description')}</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">{t('sections address tax info')}</h3>

                  <FormField
                    control={form.control}
                    name="address.countryCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('address country label')}</FormLabel>
                        <Select
                          onValueChange={(value) => {
                            field.onChange(value);
                            setSelectedCountry(value);
                          }}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('address country placeholder')}>
                                {field.value && (
                                  <div className="flex items-center">
                                    <Image
                                      src={countryOptions.find((c) => c.value === field.value)?.flag || ''}
                                      alt={t('flag alt')}
                                      width={16}
                                      height={12}
                                      className="mr-2"
                                    />
                                    {countryOptions.find((c) => c.value === field.value)?.label}
                                  </div>
                                )}
                              </SelectValue>
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {countryOptions.map((country) => (
                              <SelectItem key={country.value} value={country.value}>
                                <div className="flex items-center">
                                  <Image
                                    src={country.flag}
                                    alt={`${country.label} flag`}
                                    width={16}
                                    height={12}
                                    className="mr-2"
                                  />
                                  {country.label}
                                </div>
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
                    name="address.street"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('address street label')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('address street placeholder')} {...field} />
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
                          <Input placeholder={t('address city placeholder')} {...field} />
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
                          <Input placeholder={t('address state placeholder')} {...field} />
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
                        <FormLabel>{t('address postal code label')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('address postal code placeholder')} {...field} />
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
                              <Input placeholder={t('tax id placeholder')} {...field} />
                            </FormControl>
                            <FormDescription>
                              {t('tax id description')} {selectedCountry && taxIdRules[selectedCountry] ? t(`tax id format ${selectedCountry}`) : t('tax id format default')}
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
                              <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>{t('vat registered label')}</FormLabel>
                              <FormDescription>{t('vat registered description')}</FormDescription>
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
                  <h3 className="text-lg font-semibold">{t('sections terms')}</h3>

                  <FormField
                    control={form.control}
                    name="termsAccepted"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
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
                  <Button type="button" variant="outline" onClick={handlePreviousStep}>
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
                      setSelectedCountry('');
                      setCurrentStep(0);
                      toast({
                        description: t('form reset'),
                      });
                    }}
                  >
                    {t('reset')}
                  </Button>
                  <Button type="button" onClick={handleNextStep} disabled={loading || isUploading}>
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
                        <svg className="absolute top-0 left-0 w-full h-full" viewBox="0 0 100 100">
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
                      <strong>{t('business name label')}:</strong> {formData.businessName}
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
                      <strong>{t('phone label')}:</strong> {formData.phone || t('not provided')}
                    </p>
                    <p>
                      <strong>{t('description label')}:</strong> {formData.description || t('not provided')}
                    </p>
                    <p>
                      <strong>{t('business type label')}:</strong>{' '}
                      {formData.businessType ? t(`business type ${formData.businessType}`) : t('not provided')}
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
                      {formData.address.street || t('not provided')}
                    </p>
                    <p>
                      <strong>{t('address city label')}:</strong>{' '}
                      {formData.address.city || t('not provided')}
                    </p>
                    <p>
                      <strong>{t('address state label')}:</strong>{' '}
                      {formData.address.state || t('not provided')}
                    </p>
                    <p>
                      <strong>{t('address country label')}:</strong>{' '}
                      {formData.address.countryCode
                        ? countries[formData.address.countryCode as keyof typeof countries]?.name ||
                          formData.address.countryCode
                        : t('not provided')}
                    </p>
                    <p>
                      <strong>{t('address postal code label')}:</strong>{' '}
                      {formData.address.postalCode || t('not provided')}
                    </p>
                    {formData.businessType === 'company' && (
                      <>
                        <p>
                          <strong>{t('tax id label')}:</strong> {formData.taxId || t('not provided')}
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