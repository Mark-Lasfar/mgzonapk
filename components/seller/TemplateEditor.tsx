'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Download } from 'lucide-react';
import TiptapEditor from '@/components/ui/TiptapEditor';
import SitePreview from './SitePreview';
import TemplateLibrary from './TemplateLibrary';
import TemplateImporter from './TemplateImporter';
import { TemplateFormData, Section, SectionType } from '@/lib/types/settings';
import Editor from '@monaco-editor/react';
import sanitizeHtml from 'sanitize-html';
import { Editor as CraftEditor, Frame, Element } from '@craftjs/core';
import { Text } from '@/components/craft/Text';
import { CraftImage } from '@/components/craft/Image';
import { CraftButton } from '@/components/craft/Button';
import { Hero } from '@/components/craft/Hero';
import { Footer } from '@/components/craft/Footer';
import { ContactForm } from '@/components/craft/ContactForm';
import { Accordion } from '@/components/craft/Accordion';
import { Animation } from '@/components/craft/Animation';
import { Carousel } from '@/components/craft/Carousel';
import { CollectionBanner } from '@/components/craft/CollectionBanner';
import { Columns } from '@/components/craft/Columns';
import { CountUp } from '@/components/craft/CountUp';
import { Cta } from '@/components/craft/Cta';
import { Divider } from '@/components/craft/Divider';
import { Faq } from '@/components/craft/Faq';
import { Gallery } from '@/components/craft/Gallery';
import { Heading } from '@/components/craft/Heading';
import { Logos } from '@/components/craft/Logos';
import { Map } from '@/components/craft/Map';
import { Navigation } from '@/components/craft/Navigation';
import { Newsletter } from '@/components/craft/Newsletter';
import { Popup } from '@/components/craft/Popup';
import { PricingTable } from '@/components/craft/PricingTable';
import { ProductCard } from '@/components/craft/ProductCard';
import { Products } from '@/components/craft/Products';
import { QuickView } from '@/components/craft/QuickView';
import { RelatedProducts } from '@/components/craft/RelatedProducts';
import { Slider } from '@/components/craft/Slider';
import { Spacer } from '@/components/craft/Spacer';
import { Steps } from '@/components/craft/Steps';
import { Tabs } from '@/components/craft/Tabs';
import { TestimonialCarousel } from '@/components/craft/TestimonialCarousel';
import { Testimonials } from '@/components/craft/Testimonials';
import { Timeline } from '@/components/craft/Timeline';
import { Upsell } from '@/components/craft/Upsell';
import { Video } from '@/components/craft/Video';
// import { ChatWidget } from '@/components/craft/ChatWidget';
import { Textarea } from '../ui/textarea';
import ChatWidget from '../craft/ChatWidget';

interface Props {
  storeId: string;
  templateId?: string;
  defaultValues: TemplateFormData;
  locale: string;
  onChange: (templateData: TemplateFormData) => void;
}



const SortableItem = ({ id, children }: { id: string; children: React.ReactNode }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
};

export default function TemplateEditor({ storeId, templateId, defaultValues, locale, onChange }: Props) {
  const t = useTranslations('TemplateEditor');
  const { toast } = useToast();
  const [sections, setSections] = useState<Section[]>(
    defaultValues.layout?.map((type, index) => ({
      id: Math.random().toString(36).substr(2, 9),
      type: type as SectionType,
      content: {
        text: '',
        url: '',
        label: '',
        title: `Section ${index + 1}`,
        slug: `section-${index + 1}`,
        endDate: type === 'countdown' ? new Date().toISOString() : undefined,
        reviews: type === 'reviews' ? [] : undefined,
        images: type === 'carousel' || type === 'slider' || type === 'gallery' ? [] : undefined,
        productIds: type === 'products' || type === 'related-products' || type === 'carousel-products' ? [] : undefined,
        faqs: type === 'faq' ? [] : undefined,
        testimonials: type === 'testimonials' || type === 'testimonial-carousel' ? [] : undefined,
        backgroundImage: type === 'hero' || type === 'collection-banner' ? '' : undefined,
        backgroundColor: type === 'hero' || type === 'footer' ? '#f0f0f0' : undefined,
        endpoint: type === 'contact-form' || type === 'newsletter' ? '' : undefined,
        description: type === 'upsell' || type === 'cta' ? '' : undefined,
        productImage: type === 'upsell' || type === 'product-card' ? '' : undefined,
        productName: type === 'upsell' || type === 'product-card' ? '' : undefined,
        productPrice: type === 'upsell' || type === 'product-card' ? '' : undefined,
        buttonText: type === 'upsell' || type === 'cta' ? 'Click Here' : undefined,
        items: type === 'accordion' || type === 'tabs' || type === 'steps' || type === 'timeline' ? [] : undefined,
        settings: {},
      },
      position: index,
      customCSS: '',
      customHTML: '',
    })) || []
  );
  const [templateName, setTemplateName] = useState('');
  const [colors, setColors] = useState<TemplateFormData['colors']>(
    defaultValues.colors || { primary: '#ff6600', secondary: '#333' }
  );
  const [heroConfig, setHeroConfig] = useState<TemplateFormData['heroConfig']>(
    defaultValues.heroConfig || { title: '', subtitle: '' }
  );
  const [isPublic, setIsPublic] = useState(false);
  const [isDeveloperMode, setIsDeveloperMode] = useState(false);
  const [customCode, setCustomCode] = useState<{ [key: string]: string }>({});
  const [isResponsivePreview, setIsResponsivePreview] = useState(false);

  useEffect(() => {
    onChange({
      layout: sections.map((s) => s.type),
      colors,
      heroConfig,
      assets: defaultValues.assets || [],
    });
  }, [sections, colors, heroConfig, defaultValues.assets, onChange]);

  useEffect(() => {
    if (templateId) {
      const fetchTemplate = async () => {
        try {
          const response = await fetch(`/api/templates/${templateId}`);
          const result = await response.json();
          if (result.success) {
            setSections(result.template.sections || []);
            setTemplateName(result.template.name || '');
            setColors(result.template.colors || { primary: '#ff6600', secondary: '#333' });
            setHeroConfig(result.template.heroConfig || { title: '', subtitle: '' });
            setIsPublic(result.template.isPublic || false);
            onChange({
              layout: result.template.sections?.map((s: Section) => s.type) || [],
              colors: result.template.colors || { primary: '#ff6600', secondary: '#333' },
              heroConfig: result.template.heroConfig || { title: '', subtitle: '' },
              assets: result.template.assets || [],
            });
          } else {
            throw new Error(result.message || t('fetchTemplateFailed'));
          }
        } catch (error) {
          toast({
            variant: 'destructive',
            title: t('error'),
            description: error instanceof Error ? error.message : t('fetchTemplateFailed'),
          });
        }
      };
      fetchTemplate();
    }
  }, [templateId, t, toast, onChange]);

  const addSection = (type: SectionType) => {
    const newSection: Section = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      content: {
        title: `Section ${sections.length + 1}`,
        slug: `section-${sections.length + 1}`,
        endpoint: type === 'contact-form' ? `/api/stores/${storeId}/messages` : '',
        text: '',
        url: '',
        label: '',
        endDate: type === 'countdown' ? new Date().toISOString() : undefined,
        reviews: type === 'reviews' ? [] : undefined,
        images: type === 'carousel' || type === 'slider' || type === 'gallery' ? [] : undefined,
        productIds: type === 'products' || type === 'related-products' || type === 'carousel-products' ? [] : undefined,
        faqs: type === 'faq' ? [] : undefined,
        testimonials: type === 'testimonials' || type === 'testimonial-carousel' ? [] : undefined,
        backgroundImage: type === 'hero' || type === 'collection-banner' ? '' : undefined,
        backgroundColor: type === 'hero' || type === 'footer' ? '#f0f0f0' : undefined,
        description: type === 'upsell' || type === 'cta' ? '' : undefined,
        productImage: type === 'upsell' || type === 'product-card' ? '' : undefined,
        productName: type === 'upsell' || type === 'product-card' ? '' : undefined,
        productPrice: type === 'upsell' || type === 'product-card' ? '' : undefined,
        buttonText: type === 'upsell' || type === 'cta' ? 'Click Here' : undefined,
        items: type === 'accordion' || type === 'tabs' || type === 'steps' || type === 'timeline' ? [] : undefined,
        settings: {},
        chatScript: type === 'chat' ? '' : undefined,
      },
      position: sections.length,
      customHTML: type === 'contact-form'
        ? `
          <div class="support-page">
            <h3>Contact Us</h3>
            <form action="/api/stores/${storeId}/messages" method="POST">
              <input type="text" name="senderName" placeholder="Your Name" required />
              <input type="email" name="senderEmail" placeholder="Your Email" required />
              <textarea name="message" placeholder="Your Message" required></textarea>
              <button type="submit">Send</button>
            </form>
          </div>`
        : '',
      customCSS: type === 'contact-form'
        ? `
          .support-page {
            padding: 20px;
            background-color: #f9f9f9;
            border-radius: 8px;
          }
          .support-page form {
            display: flex;
            flex-direction: column;
            gap: 10px;
          }`
        : '',
      customJS: '',

    };
    setSections([...sections, newSection]);
  };

  const updateSection = (index: number, field: string, value: any) => {
    const newSections = [...sections];
    if (field === 'customHTML') {
      newSections[index].customHTML = sanitizeHtml(value || '', {
        allowedTags: ['p', 'b', 'i', 'em', 'strong', 'a', 'ul', 'ol', 'li', 'br', 'div', 'span', 'img', 'h3', 'h4'],
        allowedAttributes: { a: ['href'], img: ['src'], div: ['style'], span: ['style'] },
      });
    } else if (field === 'customCSS') {
      newSections[index].customCSS = value;
    } else {
      (newSections[index].content as any)[field] = value;
    }
    setSections(newSections);
  };

  const removeSection = (index: number) => {
    setSections(sections.filter((_, i) => i !== index));
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sections.findIndex((s) => s.id === active.id);
    const newIndex = sections.findIndex((s) => s.id === over.id);
    const newSections = Array.from(sections);
    const [reorderedItem] = newSections.splice(oldIndex, 1);
    newSections.splice(newIndex, 0, reorderedItem);
    newSections.forEach((section, idx) => (section.position = idx));
    setSections(newSections);
  };

  const saveTemplate = async () => {
    try {
      const sanitizedSections = sections.map((section) => ({
        ...section,
        customHTML: sanitizeHtml(section.customHTML || '', {
          allowedTags: ['p', 'b', 'i', 'em', 'strong', 'a', 'ul', 'ol', 'li', 'br', 'div', 'span', 'img', 'h3', 'h4'],
          allowedAttributes: { a: ['href'], img: ['src'], div: ['style'], span: ['style'] },
        }),
      }));
      const response = await fetch(`/api/templates`, {
        method: templateId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: templateId || undefined,
          name: templateName,
          layout: sections.map((s) => s.type),
          colors,
          heroConfig,
          sections: sanitizedSections,
          isPublic,
          storeId,
        }),
      });
      const result = await response.json();
      if (result.success) {
        toast({ title: t('success'), description: t('templateSaved') });
        onChange({
          layout: sections.map((s) => s.type),
          colors,
          heroConfig,
          assets: defaultValues.assets || [],
        });
      } else {
        throw new Error(result.message || t('saveTemplateFailed'));
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: error instanceof Error ? error.message : t('saveTemplateFailed'),
      });
    }
  };

  const publishTemplate = async () => {
    try {
      const response = await fetch(`/api/stores/${storeId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template: {
            layout: sections.map((s) => s.type),
            colors,
            heroConfig,
            assets: defaultValues.assets || [],
          },
        }),
      });
      const result = await response.json();
      if (result.success) {
        toast({ title: t('success'), description: t('templatePublished') });
        onChange({
          layout: sections.map((s) => s.type),
          colors,
          heroConfig,
          assets: defaultValues.assets || [],
        });
      } else {
        throw new Error(result.message || t('publishTemplateFailed'));
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: error instanceof Error ? error.message : t('publishTemplateFailed'),
      });
    }
  };

  const exportTemplate = () => {
    const templateData = {
      name: templateName,
      layout: sections.map((s) => s.type),
      colors,
      heroConfig,
      sections,
      assets: defaultValues.assets || [],
    };
    const blob = new Blob([JSON.stringify(templateData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${templateName || 'template'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: t('success'), description: t('templateExported') });
  };

  const handleTemplateSelect = (template: any) => {
    setSections(template.sections || []);
    setTemplateName(template.name || '');
    setColors(template.colors || { primary: '#ff6600', secondary: '#333' });
    setHeroConfig(template.heroConfig || { title: '', subtitle: '' });
    setIsPublic(template.isPublic || false);
    onChange({
      layout: template.sections?.map((s: Section) => s.type) || [],
      colors: template.colors || { primary: '#ff6600', secondary: '#333' },
      heroConfig: template.heroConfig || { title: '', subtitle: '' },
      assets: template.assets || [],
    });
  };

  return (
    <div className="container mx-auto p-6 flex gap-6">
      <div className="w-2/3">
        <Card>
          <CardHeader>
            <CardTitle>{t('title')}</CardTitle>
            <div className="flex gap-2">
              <Button onClick={() => setIsDeveloperMode(!isDeveloperMode)}>
                {isDeveloperMode ? t('switchToVisual') : t('switchToDeveloper')}
              </Button>
              <Button variant="outline" onClick={() => setIsResponsivePreview(!isResponsivePreview)}>
                {isResponsivePreview ? t('desktopPreview') : t('mobilePreview')}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder={t('templateName')}
              className="mb-4"
            />
            <TemplateImporter onImport={handleTemplateSelect} storeId={storeId} />
            <TemplateLibrary storeId={storeId} onSelect={handleTemplateSelect} />
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label>{t('primaryColor')}</label>
                <Input
                  type="color"
                  value={colors.primary}
                  onChange={(e) => setColors({ ...colors, primary: e.target.value })}
                />
              </div>
              <div>
                <label>{t('secondaryColor')}</label>
                <Input
                  type="color"
                  value={colors.secondary}
                  onChange={(e) => setColors({ ...colors, secondary: e.target.value })}
                />
              </div>
            </div>
            <div className="mb-4">
              <label>{t('heroTitle')}</label>
              <Input
                value={heroConfig.title || ''}
                onChange={(e) => setHeroConfig({ ...heroConfig, title: e.target.value })}
              />
            </div>
            <div className="mb-4">
              <label>{t('heroSubtitle')}</label>
              <Input
                value={heroConfig.subtitle || ''}
                onChange={(e) => setHeroConfig({ ...heroConfig, subtitle: e.target.value })}
              />
            </div>
            {isDeveloperMode ? (
              sections.map((section, index) => (
                <div key={section.id} className="mb-4">
                  <label>{t('htmlEditor', { section: section.type })}</label>
                  <Editor
                    height="200px"
                    defaultLanguage="html"
                    value={customCode[section.id] || section.customHTML || ''}
                    onChange={(value) => {
                      setCustomCode({ ...customCode, [section.id]: value || '' });
                      updateSection(index, 'customHTML', value);
                    }}
                  />
                  <label>{t('cssEditor')}</label>
                  <Editor
                    height="200px"
                    defaultLanguage="css"
                    value={section.customCSS || ''}
                    onChange={(value) => updateSection(index, 'customCSS', value)}
                  />
                  <label>{t('jsEditor')}</label>
                  <Editor
                    height="200px"
                    defaultLanguage="javascript"
                    value={section.customJS || ''}
                    onChange={(value) => updateSection(index, 'customJS', value)}
                  />
                </div>
              ))
            ) : (
              <CraftEditor
                resolver={{
                  Text,
                  CraftImage,
                  CraftButton,
                  Hero,
                  Footer,
                  ContactForm,
                  Accordion,
                  Animation,
                  Carousel,
                  CollectionBanner,
                  Columns,
                  CountUp,
                  Cta,
                  Divider,
                  Faq,
                  Gallery,
                  Heading,
                  Logos,
                  Map,
                  Navigation,
                  Newsletter,
                  Popup,
                  PricingTable,
                  ProductCard,
                  Products,
                  QuickView,
                  RelatedProducts,
                  Slider,
                  Spacer,
                  Steps,
                  Tabs,
                  TestimonialCarousel,
                  Testimonials,
                  Timeline,
                  Upsell,
                  Video,
                  ChatWidget,
                }}
              >
                <Frame>
                  {sections.map((section) => (
                    <Element is="div" id={section.id} canvas key={section.id}>
                      {section.type === 'text' && <Text text={section.content.text} />}
                      {section.type === 'image' && <CraftImage src={section.content.url} />}
                      {section.type === 'video' && <Video src={section.content.url} />}
                      {section.type === 'button' && <CraftButton text={section.content.label} />}
                      {section.type === 'heading' && <Heading text={section.content.text} />}
                      {section.type === 'divider' && <Divider />}
                      {section.type === 'spacer' && <Spacer />}
                      {section.type === 'carousel' && <Carousel images={section.content.images} />}
                      {section.type === 'slider' && <Slider images={section.content.images} />}
                      {section.type === 'gallery' && <Gallery images={section.content.images} />}
                      {section.type === 'columns' && <Columns columns={section.content.columns || 2} gap={section.content.gap || '20px'} />}
                      {section.type === 'pricing-table' && <PricingTable />}
                      {section.type === 'cta' && (
                        <Cta text={section.content.text} buttonText={section.content.buttonText} />
                      )}
                      {section.type === 'accordion' && <Accordion items={section.content.items} />}
                      {section.type === 'tabs' && <Tabs tabs={section.content.tabs} />}
                      {section.type === 'testimonials' && <Testimonials testimonials={section.content.testimonials} />}
                      {section.type === 'testimonial-carousel' && (
                        <TestimonialCarousel testimonials={section.content.testimonials} />
                      )}
                      {section.type === 'logos' && <Logos logos={section.content.logos} />}
                      {section.type === 'timeline' && <Timeline items={section.content.items} />}
                      {section.type === 'steps' && <Steps steps={section.content.steps} />}
                      {section.type === 'animation' && <Animation />}
                      {section.type === 'count-up' && <CountUp />}
                      {section.type === 'popup' && <Popup />}
                      {section.type === 'newsletter' && (
                        <Newsletter
                          title={section.content.title}
                          placeholder={section.content.placeholder}
                          buttonText={section.content.buttonText}
                        />
                      )}
                      {section.type === 'contact-form' && <ContactForm endpoint={section.content.endpoint} />}
                      {section.type === 'map' && <Map />}
                      {section.type === 'products' && <Products products={section.content.products} />}
                      {section.type === 'product-card' && (
                        <ProductCard
                          image={section.content.productImage}
                          title={section.content.productName}
                          price={section.content.productPrice}
                          description={section.content.description}
                          buttonText={section.content.buttonText}
                        />
                      )}
                      {section.type === 'collection-banner' && (
                        <CollectionBanner
                          image={section.content.image}
                          title={section.content.title}
                          subtitle={section.content.subtitle}
                          buttonText={section.content.buttonText}
                          buttonLink={section.content.buttonLink}
                        />
                      )}
                      {section.type === 'upsell' && (
                        <Upsell
                          title={section.content.title}
                          description={section.content.description}
                          productImage={section.content.productImage}
                          productName={section.content.productName}
                          productPrice={section.content.productPrice}
                          buttonText={section.content.buttonText}
                        />
                      )}
                      {section.type === 'related-products' && <RelatedProducts products={section.content.products} />}
                      {section.type === 'quick-view' && <QuickView />}
                      {section.type === 'carousel-products' && <Products products={section.content.products} />}
                      {section.type === 'reviews' && <Testimonials testimonials={section.content.reviews} />}
                      {section.type === 'hero' && (
                        <Hero
                          title={section.content.title || heroConfig.title}
                          subtitle={section.content.subtitle || heroConfig.subtitle}
                          backgroundImage={section.content.backgroundImage}
                        />
                      )}
                      {section.type === 'footer' && (
                        <Footer text={section.content.text} backgroundColor={section.content.backgroundColor} />
                      )}
                      {section.type === 'faq' && <Faq items={section.content.faqs} />}
                      {section.type === 'navigation' && <Navigation />}
                      {section.type === 'blog-posts' && <div>Blog Posts Placeholder</div>}
                      {section.type === 'article' && <div>Article Placeholder</div>}
                      {section.type === 'breadcrumbs' && <div>Breadcrumbs Placeholder</div>}
                      {section.type === 'sidebar' && <div>Sidebar Placeholder</div>}
                      {section.type === 'background-video' && <div>Background Video Placeholder</div>}
                      {section.type === 'icon-grid' && <div>Icon Grid Placeholder</div>}
                      {section.type === 'image-grid' && <div>Image Grid Placeholder</div>}
                      {section.type === 'shape-divider' && <div>Shape Divider Placeholder</div>}
                      {section.type === 'chat' && <ChatWidget storeId={storeId} />}
                    </Element>
                  ))}
                </Frame>
              </CraftEditor>
            )}
            <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                {sections.map((section, index) => (
                  <SortableItem key={section.id} id={section.id}>
                    <div className="flex items-center space-x-2 mb-3 p-2 border rounded">
                      <GripVertical className="h-5 w-5 cursor-move flex-shrink-0" />
                      <div className="flex-1">
                        {section.type === 'text' && (
                          <TiptapEditor
                            content={section.content.text || ''}
                            onChange={(value) => updateSection(index, 'text', value)}
                            placeholder={t('textContent')}
                          />
                        )}
                        {section.type === 'image' && (
                          <Input
                            value={section.content.url || ''}
                            onChange={(e) => updateSection(index, 'url', e.target.value)}
                            placeholder={t('imageUrl')}
                          />
                        )}
                        {section.type === 'video' && (
                          <Input
                            value={section.content.url || ''}
                            onChange={(e) => updateSection(index, 'url', e.target.value)}
                            placeholder={t('videoUrl')}
                          />
                        )}
                        {section.type === 'button' && (
                          <div className="flex space-x-2">
                            <Input
                              value={section.content.label || ''}
                              onChange={(e) => updateSection(index, 'label', e.target.value)}
                              placeholder={t('buttonLabel')}
                            />
                            <Input
                              value={section.content.url || ''}
                              onChange={(e) => updateSection(index, 'url', e.target.value)}
                              placeholder={t('buttonUrl')}
                            />
                          </div>
                        )}
                        {section.type === 'heading' && (
                          <TiptapEditor
                            content={section.content.text || ''}
                            onChange={(value) => updateSection(index, 'text', value)}
                            placeholder={t('headingText')}
                          />
                        )}
                        {section.type === 'divider' && (
                          <Input
                            value={section.content.text || ''}
                            onChange={(e) => updateSection(index, 'text', e.target.value)}
                            placeholder={t('dividerText')}
                          />
                        )}
                        {section.type === 'spacer' && (
                          <Input
                            type="number"
                            value={section.content.text || '50'}
                            onChange={(e) => updateSection(index, 'text', e.target.value)}
                            placeholder={t('spacerHeight')}
                          />
                        )}
                        {section.type === 'carousel' && (
                          <Input
                            value={section.content.images?.join(',') || ''}
                            onChange={(e) =>
                              updateSection(index, 'images', e.target.value.split(',').map((s) => s.trim()))
                            }
                            placeholder={t('carouselImages')}
                          />
                        )}
                        {section.type === 'slider' && (
                          <Input
                            value={section.content.images?.join(',') || ''}
                            onChange={(e) =>
                              updateSection(index, 'images', e.target.value.split(',').map((s) => s.trim()))
                            }
                            placeholder={t('sliderImages')}
                          />
                        )}
                        {section.type === 'gallery' && (
                          <Input
                            value={section.content.images?.join(',') || ''}
                            onChange={(e) =>
                              updateSection(index, 'images', e.target.value.split(',').map((s) => s.trim()))
                            }
                            placeholder={t('galleryImages')}
                          />
                        )}
                        {section.type === 'columns' && (
                          <div className="flex space-x-2">
                            <Input
                              type="number"
                              value={section.content.columns || '2'}
                              onChange={(e) => updateSection(index, 'columns', Number(e.target.value))}
                              placeholder={t('columnsCount')}
                            />
                            <Input
                              value={section.content.gap || '20px'}
                              onChange={(e) => updateSection(index, 'gap', e.target.value)}
                              placeholder={t('columnsGap')}
                            />
                            <TiptapEditor
                              content={JSON.stringify(section.content.children) || '[]'}
                              onChange={(value) => {
                                try {
                                  updateSection(index, 'children', JSON.parse(value));
                                } catch {
                                  toast({ variant: 'destructive', title: t('error'), description: t('invalidJSON') });
                                }
                              }}
                              placeholder={t('columnsChildren')}
                            />
                          </div>
                        )}
                        {section.type === 'pricing-table' && (
                          <TiptapEditor
                            content={JSON.stringify(section.content.items) || ''}
                            onChange={(value) => {
                              try {
                                updateSection(index, 'items', JSON.parse(value));
                              } catch {
                                toast({ variant: 'destructive', title: t('error'), description: t('invalidJSON') });
                              }
                            }}
                            placeholder={t('pricingTableContent')}
                          />
                        )}
                        {section.type === 'cta' && (
                          <div className="flex space-x-2">
                            <Input
                              value={section.content.text || ''}
                              onChange={(e) => updateSection(index, 'text', e.target.value)}
                              placeholder={t('ctaText')}
                            />
                            <Input
                              value={section.content.buttonText || ''}
                              onChange={(e) => updateSection(index, 'buttonText', e.target.value)}
                              placeholder={t('buttonText')}
                            />
                          </div>
                        )}
                        {section.type === 'accordion' && (
                          <TiptapEditor
                            content={JSON.stringify(section.content.items) || ''}
                            onChange={(value) => {
                              try {
                                updateSection(index, 'items', JSON.parse(value));
                              } catch {
                                toast({ variant: 'destructive', title: t('error'), description: t('invalidJSON') });
                              }
                            }}
                            placeholder={t('accordionItems')}
                          />
                        )}
                        {section.type === 'tabs' && (
                          <TiptapEditor
                            content={JSON.stringify(section.content.items) || ''}
                            onChange={(value) => {
                              try {
                                updateSection(index, 'items', JSON.parse(value));
                              } catch {
                                toast({ variant: 'destructive', title: t('error'), description: t('invalidJSON') });
                              }
                            }}
                            placeholder={t('tabsItems')}
                          />
                        )}
                        {section.type === 'testimonials' && (
                          <TiptapEditor
                            content={JSON.stringify(section.content.testimonials) || ''}
                            onChange={(value) => {
                              try {
                                updateSection(index, 'testimonials', JSON.parse(value));
                              } catch {
                                toast({ variant: 'destructive', title: t('error'), description: t('invalidJSON') });
                              }
                            }}
                            placeholder={t('testimonialsContent')}
                          />
                        )}
                        {section.type === 'testimonial-carousel' && (
                          <TiptapEditor
                            content={JSON.stringify(section.content.testimonials) || ''}
                            onChange={(value) => {
                              try {
                                updateSection(index, 'testimonials', JSON.parse(value));
                              } catch {
                                toast({ variant: 'destructive', title: t('error'), description: t('invalidJSON') });
                              }
                            }}
                            placeholder={t('testimonialCarouselContent')}
                          />
                        )}
                        {section.type === 'logos' && (
                          <Input
                            value={section.content.images?.join(',') || ''}
                            onChange={(e) =>
                              updateSection(index, 'images', e.target.value.split(',').map((s) => s.trim()))
                            }
                            placeholder={t('logosImages')}
                          />
                        )}
                        {section.type === 'timeline' && (
                          <TiptapEditor
                            content={JSON.stringify(section.content.items) || ''}
                            onChange={(value) => {
                              try {
                                updateSection(index, 'items', JSON.parse(value));
                              } catch {
                                toast({ variant: 'destructive', title: t('error'), description: t('invalidJSON') });
                              }
                            }}
                            placeholder={t('timelineItems')}
                          />
                        )}
                        {section.type === 'steps' && (
                          <TiptapEditor
                            content={JSON.stringify(section.content.items) || ''}
                            onChange={(value) => {
                              try {
                                updateSection(index, 'items', JSON.parse(value));
                              } catch {
                                toast({ variant: 'destructive', title: t('error'), description: t('invalidJSON') });
                              }
                            }}
                            placeholder={t('stepsItems')}
                          />
                        )}
                        {section.type === 'animation' && (
                          <Input
                            value={section.content.text || ''}
                            onChange={(e) => updateSection(index, 'text', e.target.value)}
                            placeholder={t('animationText')}
                          />
                        )}
                        {section.type === 'count-up' && (
                          <Input
                            type="number"
                            value={section.content.text || '0'}
                            onChange={(e) => updateSection(index, 'text', e.target.value)}
                            placeholder={t('countUpValue')}
                          />
                        )}
                        {section.type === 'popup' && (
                          <TiptapEditor
                            content={section.content.text || ''}
                            onChange={(value) => updateSection(index, 'text', value)}
                            placeholder={t('popupContent')}
                          />
                        )}
                        {section.type === 'newsletter' && (
                          <Input
                            value={section.content.endpoint || ''}
                            onChange={(e) => updateSection(index, 'endpoint', e.target.value)}
                            placeholder={t('newsletterEndpoint')}
                          />
                        )}
                        {section.type === 'contact-form' && (
                          <div className="space-y-2">
                            <Input
                              value={section.content.endpoint || ''}
                              onChange={(e) => updateSection(index, 'endpoint', e.target.value)}
                              placeholder={t('formEndpoint')}
                            />
                            <Textarea
                              value={section.content.chatScript || ''}
                              onChange={(e) => updateSection(index, 'chatScript', e.target.value)}
                              placeholder={t('chatScript')}
                            />
                          </div>
                        )}
                        {section.type === 'map' && (
                          <Input
                            value={section.content.text || ''}
                            onChange={(e) => updateSection(index, 'text', e.target.value)}
                            placeholder={t('mapEmbed')}
                          />
                        )}
                        {section.type === 'products' && (
                          <Input
                            value={section.content.productIds?.join(',') || ''}
                            onChange={(e) =>
                              updateSection(index, 'productIds', e.target.value.split(',').map((s) => s.trim()))
                            }
                            placeholder={t('productIds')}
                          />
                        )}
                        {section.type === 'product-card' && (
                          <div className="flex space-x-2">
                            <Input
                              value={section.content.productImage || ''}
                              onChange={(e) => updateSection(index, 'productImage', e.target.value)}
                              placeholder={t('productImage')}
                            />
                            <Input
                              value={section.content.productName || ''}
                              onChange={(e) => updateSection(index, 'productName', e.target.value)}
                              placeholder={t('productName')}
                            />
                            <Input
                              value={section.content.productPrice || ''}
                              onChange={(e) => updateSection(index, 'productPrice', e.target.value)}
                              placeholder={t('productPrice')}
                            />
                            <Input
                              value={section.content.description || ''}
                              onChange={(e) => updateSection(index, 'description', e.target.value)}
                              placeholder={t('description')}
                            />
                            <Input
                              value={section.content.buttonText || ''}
                              onChange={(e) => updateSection(index, 'buttonText', e.target.value)}
                              placeholder={t('buttonText')}
                            />
                          </div>
                        )}
                        {section.type === 'collection-banner' && (
                          <Input
                            value={section.content.backgroundImage || ''}
                            onChange={(e) => updateSection(index, 'backgroundImage', e.target.value)}
                            placeholder={t('backgroundImage')}
                          />
                        )}
                        {section.type === 'upsell' && (
                          <div className="flex space-x-2">
                            <Input
                              value={section.content.title || ''}
                              onChange={(e) => updateSection(index, 'title', e.target.value)}
                              placeholder={t('upsellTitle')}
                            />
                            <Input
                              value={section.content.description || ''}
                              onChange={(e) => updateSection(index, 'description', e.target.value)}
                              placeholder={t('upsellDescription')}
                            />
                            <Input
                              value={section.content.productImage || ''}
                              onChange={(e) => updateSection(index, 'productImage', e.target.value)}
                              placeholder={t('productImage')}
                            />
                            <Input
                              value={section.content.productName || ''}
                              onChange={(e) => updateSection(index, 'productName', e.target.value)}
                              placeholder={t('productName')}
                            />
                            <Input
                              value={section.content.productPrice || ''}
                              onChange={(e) => updateSection(index, 'productPrice', e.target.value)}
                              placeholder={t('productPrice')}
                            />
                            <Input
                              value={section.content.buttonText || ''}
                              onChange={(e) => updateSection(index, 'buttonText', e.target.value)}
                              placeholder={t('buttonText')}
                            />
                          </div>
                        )}
                        {section.type === 'related-products' && (
                          <Input
                            value={section.content.productIds?.join(',') || ''}
                            onChange={(e) =>
                              updateSection(index, 'productIds', e.target.value.split(',').map((s) => s.trim()))
                            }
                            placeholder={t('productIds')}
                          />
                        )}
                        {section.type === 'quick-view' && (
                          <Input
                            value={section.content.productName || ''}
                            onChange={(e) => updateSection(index, 'productName', e.target.value)}
                            placeholder={t('productName')}
                          />
                        )}
                        {section.type === 'carousel-products' && (
                          <Input
                            value={section.content.productIds?.join(',') || ''}
                            onChange={(e) =>
                              updateSection(index, 'productIds', e.target.value.split(',').map((s) => s.trim()))
                            }
                            placeholder={t('productIds')}
                          />
                        )}
                        {section.type === 'reviews' && (
                          <TiptapEditor
                            content={JSON.stringify(section.content.reviews) || ''}
                            onChange={(value) => {
                              try {
                                updateSection(index, 'reviews', JSON.parse(value));
                              } catch {
                                toast({ variant: 'destructive', title: t('error'), description: t('invalidJSON') });
                              }
                            }}
                            placeholder={t('reviewsContent')}
                          />
                        )}
                        {section.type === 'hero' && (
                          <div className="flex space-x-2">
                            <Input
                              value={section.content.title || heroConfig.title}
                              onChange={(e) => updateSection(index, 'title', e.target.value)}
                              placeholder={t('heroTitle')}
                            />
                            <Input
                              value={section.content.subtitle || heroConfig.subtitle}
                              onChange={(e) => updateSection(index, 'subtitle', e.target.value)}
                              placeholder={t('heroSubtitle')}
                            />
                            <Input
                              value={section.content.backgroundImage || ''}
                              onChange={(e) => updateSection(index, 'backgroundImage', e.target.value)}
                              placeholder={t('backgroundImage')}
                            />
                          </div>
                        )}
                        {section.type === 'footer' && (
                          <div className="flex space-x-2">
                            <Input
                              value={section.content.text || ''}
                              onChange={(e) => updateSection(index, 'text', e.target.value)}
                              placeholder={t('footerText')}
                            />
                            <Input
                              type="color"
                              value={section.content.backgroundColor || '#f0f0f0'}
                              onChange={(e) => updateSection(index, 'backgroundColor', e.target.value)}
                              placeholder={t('backgroundColor')}
                            />
                          </div>
                        )}
                        {section.type === 'faq' && (
                          <div className="space-y-2">
                            <Button
                              onClick={() => {
                                const newFaqs = [...(section.content.faqs || []), { question: '', answer: '' }];
                                updateSection(index, 'faqs', newFaqs);
                              }}
                            >
                              {t('addFaq')}
                            </Button>
                            {(section.content.faqs || []).map((faq: { question: string; answer: string }, faqIndex: number) => (
                              <div key={faqIndex} className="flex space-x-2">
                                <Input
                                  value={faq.question}
                                  onChange={(e) => {
                                    const newFaqs = [...(section.content.faqs || [])];
                                    newFaqs[faqIndex].question = e.target.value;
                                    updateSection(index, 'faqs', newFaqs);
                                  }}
                                  placeholder={t('faqQuestion')}
                                />
                                <Input
                                  value={faq.answer}
                                  onChange={(e) => {
                                    const newFaqs = [...(section.content.faqs || [])];
                                    newFaqs[faqIndex].answer = e.target.value;
                                    updateSection(index, 'faqs', newFaqs);
                                  }}
                                  placeholder={t('faqAnswer')}
                                />
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => {
                                    const newFaqs = section.content.faqs?.filter((_, i) => i !== faqIndex);
                                    updateSection(index, 'faqs', newFaqs);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                        {section.type === 'navigation' && (
                          <TiptapEditor
                            content={JSON.stringify(section.content.items) || ''}
                            onChange={(value) => {
                              try {
                                updateSection(index, 'items', JSON.parse(value));
                              } catch {
                                toast({ variant: 'destructive', title: t('error'), description: t('invalidJSON') });
                              }
                            }}
                            placeholder={t('navigationItems')}
                          />
                        )}
                        {section.type === 'blog-posts' && (
                          <TiptapEditor
                            content={JSON.stringify(section.content.items) || ''}
                            onChange={(value) => {
                              try {
                                updateSection(index, 'items', JSON.parse(value));
                              } catch {
                                toast({ variant: 'destructive', title: t('error'), description: t('invalidJSON') });
                              }
                            }}
                            placeholder={t('blogPostsContent')}
                          />
                        )}
                        {section.type === 'article' && (
                          <TiptapEditor
                            content={section.content.text || ''}
                            onChange={(value) => updateSection(index, 'text', value)}
                            placeholder={t('articleContent')}
                          />
                        )}
                        {section.type === 'breadcrumbs' && (
                          <TiptapEditor
                            content={JSON.stringify(section.content.items) || ''}
                            onChange={(value) => {
                              try {
                                updateSection(index, 'items', JSON.parse(value));
                              } catch {
                                toast({ variant: 'destructive', title: t('error'), description: t('invalidJSON') });
                              }
                            }}
                            placeholder={t('breadcrumbsItems')}
                          />
                        )}
                        {section.type === 'sidebar' && (
                          <TiptapEditor
                            content={section.content.text || ''}
                            onChange={(value) => updateSection(index, 'text', value)}
                            placeholder={t('sidebarContent')}
                          />
                        )}
                        {section.type === 'background-video' && (
                          <Input
                            value={section.content.url || ''}
                            onChange={(e) => updateSection(index, 'url', e.target.value)}
                            placeholder={t('videoUrl')}
                          />
                        )}
                        {section.type === 'icon-grid' && (
                          <TiptapEditor
                            content={JSON.stringify(section.content.items) || ''}
                            onChange={(value) => {
                              try {
                                updateSection(index, 'items', JSON.parse(value));
                              } catch {
                                toast({ variant: 'destructive', title: t('error'), description: t('invalidJSON') });
                              }
                            }}
                            placeholder={t('iconGridItems')}
                          />
                        )}
                        {section.type === 'image-grid' && (
                          <Input
                            value={section.content.images?.join(',') || ''}
                            onChange={(e) =>
                              updateSection(index, 'images', e.target.value.split(',').map((s) => s.trim()))
                            }
                            placeholder={t('imageGridImages')}
                          />
                        )}
                        {section.type === 'shape-divider' && (
                          <Input
                            value={section.content.text || ''}
                            onChange={(e) => updateSection(index, 'text', e.target.value)}
                            placeholder={t('shapeDividerText')}
                          />
                        )}
                      </div>
                      <Button type="button" variant="destructive" size="sm" onClick={() => removeSection(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </SortableItem>
                ))}
              </SortableContext>
            </DndContext>
            <Select onValueChange={(value) => addSection(value as SectionType)}>
              <SelectTrigger className="mt-4">
                <SelectValue placeholder={t('addSection')} />
              </SelectTrigger>
              <SelectContent>
                {([
                  'text', 'image', 'video', 'button', 'heading', 'divider', 'spacer',
                  'carousel', 'slider', 'gallery', 'columns', 'pricing-table', 'cta', 'accordion', 'tabs',
                  'testimonials', 'testimonial-carousel', 'logos', 'timeline', 'steps', 'animation', 'count-up',
                  'popup', 'newsletter', 'contact-form', 'map', 'products', 'product-card', 'collection-banner',
                  'upsell', 'related-products', 'quick-view', 'carousel-products', 'reviews', 'hero', 'footer',
                  'faq', 'navigation', 'blog-posts', 'article', 'breadcrumbs', 'sidebar', 'background-video',
                  'icon-grid', 'image-grid', 'shape-divider', 'chat',
                ] as const).map((type) => (
                  <SelectItem key={type} value={type}>
                    {t(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2 mt-4">
              <Button onClick={saveTemplate}>{t('saveTemplate')}</Button>
              <Button onClick={publishTemplate} variant="outline">{t('publishTemplate')}</Button>
              <Button onClick={exportTemplate} variant="secondary">
                <Download className="h-4 w-4 mr-2" />
                {t('exportTemplate')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="w-1/3">
        <SitePreview
          settings={{
            theme: 'default',
            primaryColor: colors.primary,
            logo: undefined,
            bannerImage: undefined,
            customSections: sections.map((section) => ({
              title: section.content.title || `Section ${section.position + 1}`,
              slug: section.content.slug || `section-${section.id}`,
              content: JSON.stringify(section.content),
              type: section.type,
              position: section.position,
              customCSS: section.customCSS,
              customHTML: section.customHTML,
            })),
          }}
          template={{
            colors,
            heroConfig,
            layout: sections.map((s) => s.type),
            assets: defaultValues.assets || [],
          }}
          storeId={storeId}
          isMobile={isResponsivePreview}
        />
      </div>
    </div>
  );
}