'use client';

import { useTranslations } from 'next-intl';
import { SettingsFormData, SectionType } from '@/lib/types/settings';
import Image from 'next/image';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface Props {
  settings?: SettingsFormData['customSite'];
  template?: SettingsFormData['template'];
  storeId: string;
  isMobile?: boolean;
}

export default function SitePreview({ settings, template, storeId, isMobile = false }: Props) {
  const t = useTranslations('SitePreview');
  const { toast } = useToast();
  const [isPublishing, setIsPublishing] = useState(false);

  // Use useMemo to optimize re-renders
  const previewData = useMemo(() => ({ settings, template }), [settings, template]);

  const publishChanges = async () => {
    setIsPublishing(true);
    try {
      const response = await fetch(`/api/stores/${storeId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings, template }),
      });
      const result = await response.json();
      if (result.success) {
        toast({ title: t('success'), description: t('sitePublished') });
      } else {
        throw new Error(result.message || t('publishFailed'));
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: error instanceof Error ? error.message : t('publishFailed'),
      });
    } finally {
      setIsPublishing(false);
    }
  };

  // Helper function to safely parse content
  const parseContent = (content: string) => {
    try {
      return JSON.parse(content);
    } catch {
      return null;
    }
  };

  // Render section based on type
  const renderSection = (
    section: NonNullable<NonNullable<SettingsFormData['customSite']>['customSections']>[number],
    index: number
  ) => {
    const content = parseContent(section.content);

    switch (section.type as SectionType) {
      case 'hero':
        return (
          <div key={index} className="my-4 text-center">
            <h2 className="text-2xl font-bold">{section.title}</h2>
            <p className="text-gray-500">{section.slug}</p>
            <div className="prose" dangerouslySetInnerHTML={{ __html: section.content }} />
            {section.customCSS && <style>{section.customCSS}</style>}
            {section.customHTML && <div dangerouslySetInnerHTML={{ __html: section.customHTML }} />}
          </div>
        );
      case 'products':
        return (
          <div key={index} className="my-4">
            <h2 className="text-xl font-semibold">{section.title}</h2>
            <p className="text-gray-500">{section.slug}</p>
            {content?.productIds?.length ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {content.productIds.map((id: string) => (
                  <div key={id} className="border p-4 rounded-md">
                    <p>{t('product')} {id}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">{t('noProducts')}</p>
            )}
            {section.customCSS && <style>{section.customCSS}</style>}
            {section.customHTML && <div dangerouslySetInnerHTML={{ __html: section.customHTML }} />}
          </div>
        );
      case 'testimonials':
        return (
          <div key={index} className="my-4">
            <h2 className="text-xl font-semibold">{section.title}</h2>
            <p className="text-gray-500">{section.slug}</p>
            {content?.testimonials?.length ? (
              <div className="space-y-4">
                {content.testimonials.map((testimonial: any, i: number) => (
                  <div key={i} className="border-l-4 border-primary pl-4">
                    <p>{testimonial.text}</p>
                    <p className="text-sm text-gray-500">— {testimonial.author}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="prose" dangerouslySetInnerHTML={{ __html: section.content }} />
            )}
            {section.customCSS && <style>{section.customCSS}</style>}
            {section.customHTML && <div dangerouslySetInnerHTML={{ __html: section.customHTML }} />}
          </div>
        );
      case 'faq':
        return (
          <div key={index} className="my-4">
            <h2 className="text-xl font-semibold">{section.title}</h2>
            <p className="text-gray-500">{section.slug}</p>
            {content?.faqs?.length ? (
              <div className="space-y-4">
                {content.faqs.map((faq: any, i: number) => (
                  <div key={i}>
                    <h3 className="font-medium">{faq.question}</h3>
                    <p className="text-gray-600">{faq.answer}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="prose" dangerouslySetInnerHTML={{ __html: section.content }} />
            )}
            {section.customCSS && <style>{section.customCSS}</style>}
            {section.customHTML && <div dangerouslySetInnerHTML={{ __html: section.customHTML }} />}
          </div>
        );
      case 'footer':
        return (
          <footer key={index} className="my-4 text-center bg-gray-800 text-white p-4">
            <h2 className="text-xl font-semibold">{section.title}</h2>
            <p className="text-gray-300">{section.slug}</p>
            <div className="prose" dangerouslySetInnerHTML={{ __html: section.content }} />
            {section.customCSS && <style>{section.customCSS}</style>}
            {section.customHTML && <div dangerouslySetInnerHTML={{ __html: section.customHTML }} />}
          </footer>
        );
      case 'contact-form':
        return (
          <div key={index} className="my-4 p-4 border rounded">
            <h2 className="text-xl font-semibold">{section.title}</h2>
            <p className="text-gray-500">{section.slug}</p>
            <form action={content?.url || '#'} method="POST">
              <div className="mb-4">
                <label htmlFor="name" className="block">Name</label>
                <input type="text" id="name" name="name" className="w-full p-2 border" />
              </div>
              <div className="mb-4">
                <label htmlFor="email" className="block">Email</label>
                <input type="email" id="email" name="email" className="w-full p-2 border" />
              </div>
              <div className="mb-4">
                <label htmlFor="message" className="block">Message</label>
                <textarea id="message" name="message" className="w-full p-2 border" />
              </div>
              <button type="submit" className="bg-primary text-white p-2 rounded">Submit</button>
            </form>
            {section.customCSS && <style>{section.customCSS}</style>}
            {section.customHTML && <div dangerouslySetInnerHTML={{ __html: section.customHTML }} />}
          </div>
        );
      case 'custom':
      default:
        return (
          <div key={index} className="my-4">
            <h2 className="text-xl font-semibold">{section.title}</h2>
            <p className="text-gray-500">{section.slug}</p>
            <div className="prose" dangerouslySetInnerHTML={{ __html: section.content }} />
            {section.customCSS && <style>{section.customCSS}</style>}
            {section.customHTML && <div dangerouslySetInnerHTML={{ __html: section.customHTML }} />}
          </div>
        );
    }
  };

  return (
    <Card className={isMobile ? 'max-w-sm mx-auto' : ''}>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent style={{ backgroundColor: previewData.settings?.primaryColor || '#fff' }}>
        {previewData.settings?.logo && (
          <div className="mb-4">
            <Image
              src={typeof previewData.settings.logo === 'string' ? previewData.settings.logo : URL.createObjectURL(previewData.settings.logo)}
              alt="Store Logo"
              width={isMobile ? 80 : 100}
              height={isMobile ? 80 : 100}
              className="object-contain"
            />
          </div>
        )}
        {previewData.settings?.bannerImage && (
          <div className="mb-4">
            <Image
              src={typeof previewData.settings.bannerImage === 'string' ? previewData.settings.bannerImage : URL.createObjectURL(previewData.settings.bannerImage)}
              alt="Banner"
              width={isMobile ? 300 : 1200}
              height={isMobile ? 100 : 300}
              className="w-full h-auto object-cover rounded-md"
            />
          </div>
        )}
        {previewData.template?.heroConfig && (
          <div className="my-4 text-center">
            <h1 className={isMobile ? 'text-2xl font-bold' : 'text-3xl font-bold'}>
              {previewData.template.heroConfig.title || t('defaultTitle')}
            </h1>
            <p className={isMobile ? 'text-base text-gray-600' : 'text-lg text-gray-600'}>
              {previewData.template.heroConfig.subtitle || t('defaultSubtitle')}
            </p>
          </div>
        )}
        {previewData.settings?.customSections?.length ? (
          previewData.settings.customSections.map(renderSection)
        ) : (
          <p className="text-gray-500">{t('noSections')}</p>
        )}
        <Button onClick={publishChanges} disabled={isPublishing} className="mt-4">
          {isPublishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {t('publish')}
        </Button>
      </CardContent>
    </Card>
  );
}