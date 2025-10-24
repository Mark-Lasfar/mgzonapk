'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { UseFormReturn } from 'react-hook-form';
import { SettingsFormData, SectionType } from '@/lib/types/settings';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Trash2 } from 'lucide-react';
import TiptapEditor from '@/components/ui/TiptapEditor';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@radix-ui/react-select';
import { Textarea } from '@/components/ui/textarea';
import Editor from '@monaco-editor/react';
import styled from 'styled-components';
import sanitizeHtml from 'sanitize-html';

interface Page {
  id: string;
  title: string;
  slug: string;
  content: string;
  type: SectionType;
  customCSS?: string;
  customHTML?: string;
}

interface Props {
  form: UseFormReturn<SettingsFormData>;
  id: string;
  availablePaymentProviders: {
    providerName: string;
  }[];
}

const StyledCard = styled(Card)`
  background-color: hsl(var(--card));
  color: hsl(var(--card-foreground));
`;

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

export default function PageManager({ form }: Props) {
  const t = useTranslations('PageManager');
  const [pages, setPages] = useState<Page[]>(form.getValues('customSite.customSections')?.map((section, index) => ({
    id: `page-${index}`,
    title: section.title,
    slug: section.slug,
    content: section.content,
    type: section.type,
    customCSS: section.customCSS || '',
    customHTML: section.customHTML || '',
  })) || []);
  const [isCodeMode, setIsCodeMode] = useState(false);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = pages.findIndex((p) => p.id === active.id);
    const newIndex = pages.findIndex((p) => p.id === over.id);
    const newPages = [...pages];
    const [reorderedItem] = newPages.splice(oldIndex, 1);
    newPages.splice(newIndex, 0, reorderedItem);
    setPages(newPages);
    form.setValue('customSite.customSections', newPages.map((page) => ({
      title: page.title,
      content: page.content,
      position: newPages.indexOf(page),
      type: page.type,
      slug: page.slug,
      customCSS: page.customCSS,
      customHTML: page.customHTML,
    })));
  };

  const addPage = (type: SectionType) => {
    const newPage: Page = {
      id: `page-${Date.now()}`,
      title: t(`new${type.charAt(0).toUpperCase() + type.slice(1)}Page`),
      slug: `new-${type}-${Date.now()}`,
      content: type === 'products' ? JSON.stringify({ productIds: [] }) : '',
      type,
      customCSS: '',
      customHTML: '',
    };
    setPages([...pages, newPage]);
    form.setValue('customSite.customSections', [
      ...(form.getValues('customSite.customSections') || []),
      { title: newPage.title, content: newPage.content, position: pages.length, type: newPage.type, slug: newPage.slug, customCSS: '', customHTML: '' },
    ]);
  };

  const removePage = (index: number) => {
    const newPages = pages.filter((_, i) => i !== index);
    setPages(newPages);
    form.setValue('customSite.customSections', newPages.map((page) => ({
      title: page.title,
      content: page.content,
      position: newPages.indexOf(page),
      type: page.type,
      slug: page.slug,
      customCSS: page.customCSS,
      customHTML: page.customHTML,
    })));
  };

  const updatePage = (index: number, field: keyof Page, value: string) => {
    const newPages = [...pages];
    if (field === 'type') {
      if ([
        'text', 'image', 'video', 'button', 'heading', 'divider', 'spacer',
        'carousel', 'slider', 'gallery', 'columns', 'features-grid', 'pricing-table', 'cta', 'accordion', 'tabs', 'testimonials', 'testimonial-carousel', 'logos', 'timeline', 'steps', 'animation', 'count-up',
        'popup', 'newsletter', 'contact-form', 'map',
        'products', 'product-card', 'collection-banner', 'upsell', 'related-products', 'quick-view', 'carousel-products', 'reviews',
        'hero', 'footer', 'faq', 'breadcrumbs', 'navigation', 'sidebar', 'blog-posts', 'article', 'background-video', 'icon-grid', 'image-grid', 'shape-divider',
      ].includes(value)) {
        newPages[index][field] = value as SectionType;
      }
    } else if (field === 'customCSS' || field === 'customHTML') {
      newPages[index][field] = sanitizeHtml(value, {
        allowedTags: field === 'customHTML' ? sanitizeHtml.defaults.allowedTags.concat(['style', 'div', 'span', 'img']) : [],
        allowedAttributes: { '*': ['style', 'class'], img: ['src'], a: ['href'] },
      });
    } else {
      newPages[index][field] = value;
      if (field === 'title') {
        newPages[index].slug = value.toLowerCase().replace(/\s+/g, '-');
      }
    }
    setPages(newPages);
    form.setValue('customSite.customSections', newPages.map((page) => ({
      title: page.title,
      content: page.content,
      position: newPages.indexOf(page),
      type: page.type,
      slug: page.slug,
      customCSS: page.customCSS,
      customHTML: page.customHTML,
    })));
  };

  return (
    <StyledCard className="animate-slide-up">
      <CardHeader>
        <CardTitle>{t('managePages')}</CardTitle>
        <Button onClick={() => setIsCodeMode(!isCodeMode)} variant="outline">
          {isCodeMode ? t('visualMode') : t('codeMode')}
        </Button>
      </CardHeader>
      <CardContent>
        <Select onValueChange={(value) => addPage(value as SectionType)}>
          <SelectTrigger>
            <SelectValue placeholder={t('addPage')} />
          </SelectTrigger>
          <SelectContent>
            {([
              'text', 'image', 'video', 'button', 'heading', 'divider', 'spacer',
              'carousel', 'slider', 'gallery', 'columns', 'features-grid', 'pricing-table', 'cta', 'accordion', 'tabs', 'testimonials', 'testimonial-carousel', 'logos', 'timeline', 'steps', 'animation', 'count-up',
              'popup', 'newsletter', 'contact-form', 'map',
              'products', 'product-card', 'collection-banner', 'upsell', 'related-products', 'quick-view', 'carousel-products', 'reviews',
              'hero', 'footer', 'faq', 'breadcrumbs', 'navigation', 'sidebar', 'blog-posts', 'article', 'background-video', 'icon-grid', 'image-grid', 'shape-divider','chat',
            ] as const).map((type) => (
              <SelectItem key={type} value={type}>
                {t(type)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={pages.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            {pages.map((page, index) => (
              <SortableItem key={page.id} id={page.id}>
                <div className="p-4 border rounded-md bg-background draggable-item">
                  {isCodeMode ? (
                    <div className="space-y-4">
                      <FormItem>
                        <FormLabel>{t('customCSS')}</FormLabel>
                        <Editor
                          height="200px"
                          defaultLanguage="css"
                          value={page.customCSS}
                          onChange={(value) => updatePage(index, 'customCSS', value || '')}
                          theme="vs-dark"
                        />
                      </FormItem>
                      <FormItem>
                        <FormLabel>{t('customHTML')}</FormLabel>
                        <Editor
                          height="200px"
                          defaultLanguage="html"
                          value={page.customHTML}
                          onChange={(value) => updatePage(index, 'customHTML', value || '')}
                          theme="vs-dark"
                        />
                      </FormItem>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="cursor-move">☰</span>
                      <Input
                        value={page.title}
                        onChange={(e) => updatePage(index, 'title', e.target.value)}
                        placeholder={t('pageTitle')}
                        className="border-border"
                      />
                      <Input
                        value={page.slug}
                        onChange={(e) => updatePage(index, 'slug', e.target.value)}
                        placeholder={t('pageSlug')}
                        className="border-border"
                      />
                      <Button variant="destructive" size="sm" onClick={() => removePage(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  <FormField
                    control={form.control}
                    name={`customSite.customSections.${index}.content`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('pageContent')}</FormLabel>
                        <FormControl>
                          {page.type === 'custom' ? (
                            <TiptapEditor
                              content={field.value || ''}
                              onChange={(value) => field.onChange(value)}
                              placeholder={t('enterPageContent')}
                            />
                          ) : page.type === 'products' ? (
                            <Input
                              value={field.value}
                              onChange={(e) => field.onChange(e.target.value)}
                              placeholder={t('productIds')}
                              className="border-border"
                            />
                          ) : (
                            <Textarea {...field} placeholder={t('enterPageContent')} className="border-border" />
                          )}
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {page.customHTML && (
                    <div className="mt-4" dangerouslySetInnerHTML={{ __html: page.customHTML }} />
                  )}
                </div>
              </SortableItem>
            ))}
          </SortableContext>
        </DndContext>
      </CardContent>
    </StyledCard>
  );
}