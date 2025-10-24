'use client';

import { useCallback, useState } from 'react';
import { useFormContext, useFieldArray } from 'react-hook-form';
import { SettingsFormData } from '@/lib/types/settings';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useDropzone } from 'react-dropzone';
import Image from 'next/image';
import { Loader2, Trash2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import SitePreview from './SitePreview';

interface Props {
  form: ReturnType<typeof useFormContext<SettingsFormData>>;
  locale: string;
  storeId: string; 
}

export default function SellerCustomSiteForm({ form, locale, storeId }: Props) {
  const t = useTranslations('SellerSettings');
  const { toast } = useToast();
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'customSite.customSections',
  });

  const onDropLogo = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];
        form.setValue('customSite.logo', file);
        setLogoPreview(URL.createObjectURL(file));
      }
    },
    [form]
  );

  const onDropBanner = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];
        form.setValue('customSite.bannerImage', file);
        setBannerPreview(URL.createObjectURL(file));
      }
    },
    [form]
  );

  const logoDropzone = useDropzone({
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp'] },
    maxSize: 5 * 1024 * 1024, // 5MB
    onDrop: onDropLogo,
  });

  const bannerDropzone = useDropzone({
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp'] },
    maxSize: 5 * 1024 * 1024, // 5MB
    onDrop: onDropBanner,
  });

  const removeLogo = () => {
    form.setValue('customSite.logo', null);
    setLogoPreview(null);
  };

  const removeBanner = () => {
    form.setValue('customSite.bannerImage', null);
    setBannerPreview(null);
  };

  const onSubmit = async (data: SettingsFormData) => {
    try {
      const formData = new FormData();
      formData.append('settings', JSON.stringify({ customSite: data.customSite }));
      if (data.customSite?.logo instanceof File) {
        formData.append('logo', data.customSite.logo);
      }
      if (data.customSite?.bannerImage instanceof File) {
        formData.append('bannerImage', data.customSite.bannerImage);
      }

      const response = await fetch('/api/seller/settings', {
        method: 'PATCH',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(t('errors.saveFailed'));
      }

      toast({
        title: t('success'),
        description: t('customSiteUpdated'),
      });
    } catch (error) {
      toast({
        title: t('errors.saveFailed'),
        description: error instanceof Error ? error.message : t('errors.saveFailed'),
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="container mx-auto p-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('customSite.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="customSite.theme"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('theme')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('enterTheme')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="default">{t('customSite.theme.default')}</SelectItem>
                        <SelectItem value="modern">{t('customSite.theme.modern')}</SelectItem>
                        <SelectItem value="minimal">{t('customSite.theme.minimal')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="customSite.primaryColor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('primaryColor')}</FormLabel>
                    <FormControl>
                      <Input type="color" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="customSite.logo"
                render={() => (
                  <FormItem>
                    <FormLabel>{t('logo')}</FormLabel>
                    <FormControl>
                      <div
                        {...logoDropzone.getRootProps()}
                        className="border-2 border-dashed border-gray-300 p-4 rounded-md cursor-pointer hover:border-gray-400"
                      >
                        <input {...logoDropzone.getInputProps()} />
                        <p className="text-center text-gray-500">{t('dragDropLogo')} {t('orClick')}</p>
                        {logoPreview && (
                          <div className="mt-4 flex items-center gap-2">
                            <Image src={logoPreview} alt="Logo Preview" width={100} height={100} />
                            <Button variant="destructive" size="sm" onClick={removeLogo}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="customSite.bannerImage"
                render={() => (
                  <FormItem>
                    <FormLabel>{t('bannerImage')}</FormLabel>
                    <FormControl>
                      <div
                        {...bannerDropzone.getRootProps()}
                        className="border-2 border-dashed border-gray-300 p-4 rounded-md cursor-pointer hover:border-gray-400"
                      >
                        <input {...bannerDropzone.getInputProps()} />
                        <p className="text-center text-gray-500">{t('dragDropBanner')} {t('orClick')}</p>
                        {bannerPreview && (
                          <div className="mt-4 flex items-center gap-2">
                            <Image src={bannerPreview} alt="Banner Preview" width={200} height={100} />
                            <Button variant="destructive" size="sm" onClick={removeBanner}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="customSite.seo.metaTitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('metaTitle')}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={t('enterMetaTitle')} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="customSite.seo.metaDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('metaDescription')}</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder={t('enterMetaDescription')} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="customSite.customDomain"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('customDomain')}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={t('enterCustomDomain')} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">{t('customSite.sections.title')}</h3>
                {fields.map((fieldItem, index) => (
                  <Card key={fieldItem.id} className="p-4">
                    <FormField
                      control={form.control}
                      name={`customSite.customSections.${index}.title`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('customSite.sections.title.label')}</FormLabel>
                          <FormControl>
                            <Input
                              placeholder={t('customSite.sections.title.placeholder')}
                              {...field}
                              onChange={(e) => {
                                field.onChange(e);
                                form.setValue(
                                  `customSite.customSections.${index}.slug`,
                                  e.target.value.toLowerCase().replace(/\s+/g, '-') || `section-${fieldItem.id}`
                                );
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`customSite.customSections.${index}.slug`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('customSite.sections.slug.label')}</FormLabel>
                          <FormControl>
                            <Input placeholder={t('customSite.sections.slug.placeholder')} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`customSite.customSections.${index}.type`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('customSite.sections.type.label')}</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t('customSite.sections.type.placeholder')} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="custom">{t('customSite.sections.type.custom')}</SelectItem>
                              <SelectItem value="hero">{t('customSite.sections.type.hero')}</SelectItem>
                              <SelectItem value="products">{t('customSite.sections.type.products')}</SelectItem>
                              <SelectItem value="testimonials">{t('customSite.sections.type.testimonials')}</SelectItem>
                              <SelectItem value="faq">{t('customSite.sections.type.faq')}</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`customSite.customSections.${index}.content`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('customSite.sections.content.label')}</FormLabel>
                          <FormControl>
                            <Textarea placeholder={t('customSite.sections.content.placeholder')} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`customSite.customSections.${index}.position`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('customSite.sections.position.label')}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder={t('customSite.sections.position.placeholder')}
                              {...field}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="button" variant="destructive" onClick={() => remove(index)}>
                      {t('customSite.sections.remove')}
                    </Button>
                  </Card>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    append({
                      title: '',
                      slug: '',
                      content: '',
                      type: 'custom',
                      position: fields.length + 1,
                    })
                  }
                >
                  {t('customSite.sections.add')}
                </Button>
              </div>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {t('save')}
              </Button>
            </CardContent>
          </Card>
        </form>
      </Form>
      <SitePreview
        settings={form.watch('customSite')}
        template={form.watch('template')}
        storeId={storeId}
      />
    </div>
  );
}