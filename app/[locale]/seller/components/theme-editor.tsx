// المسار: /home/hager/Trash/my-nextjs-project-master/app/seller/components/theme-editor.tsx
'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { GripVertical, Trash2 } from 'lucide-react';
// import ProductPreview from '@/components/product-preview';
import { useToast } from '@/components/ui/toast';
import { logger } from '@/lib/utils/logger';
import ProductPreview from './product-preview';

interface Section {
  id: string;
  type: string;
  content: Record<string, any>;
  position: number;
}

export default function ThemeEditor({ productId }: { productId?: string }) {
  const t = useTranslations('Seller.ThemeEditor');
  const { toast } = useToast();
  const [sections, setSections] = useState<Section[]>([]);
  const [previewData, setPreviewData] = useState<any>({});

  // جلب بيانات المنتج عند تحميل المكون
  useEffect(() => {
    const fetchProduct = async () => {
      if (!productId) return;
      try {
        const response = await fetch(`/api/products/${productId}`, {
          headers: { 'Content-Type': 'application/json' },
        });
        const data = await response.json();
        if (data.success) {
          setPreviewData(data.data);
          setSections(data.data.sections || []);
          logger.info('Product data fetched for theme editor', { productId });
        } else {
          throw new Error(data.message || t('fetchProductFailed'));
        }
      } catch (error) {
        logger.error('Failed to fetch product data', { error });
        toast({
          variant: 'destructive',
          title: t('error'),
          description: error instanceof Error ? error.message : t('fetchProductFailed'),
        });
      }
    };
    fetchProduct();
  }, [productId, t, toast]);

  // إضافة قسم جديد
  const addSection = (type: string) => {
    const newSection: Section = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      content: {
        text: '',
        url: '',
        label: '',
        endDate: type === 'countdown' ? new Date().toISOString() : undefined,
        reviews: type === 'reviews' ? [] : undefined,
        images: type === 'carousel' ? [] : undefined,
      },
      position: sections.length,
    };
    setSections([...sections, newSection]);
    logger.info('Section added', { type, sectionId: newSection.id });
  };

  // تحديث محتوى قسم
  const updateSection = (index: number, field: string, value: any) => {
    const newSections = [...sections];
    newSections[index].content[field] = value;
    setSections(newSections);
    logger.info('Section updated', { index, field, value });
  };

  // إزالة قسم
  const removeSection = (index: number) => {
    const sectionId = sections[index].id;
    const newSections = sections.filter((_, i) => i !== index);
    setSections(newSections);
    logger.info('Section removed', { sectionId, index });
  };

  // إعادة ترتيب الأقسام باستخدام Drag-and-Drop
  const onDragEnd = (result: any) => {
    if (!result.destination) return;
    const newSections = Array.from(sections);
    const [reorderedItem] = newSections.splice(result.source.index, 1);
    newSections.splice(result.destination.index, 0, reorderedItem);
    newSections.forEach((section, idx) => (section.position = idx));
    setSections(newSections);
    logger.info('Sections reordered', { newOrder: newSections.map((s) => s.id) });
  };

  // حفظ القالب
  const saveTemplate = async () => {
    try {
      const response = await fetch(`/api/products/${productId}/template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sections }),
      });
      const result = await response.json();
      if (result.success) {
        toast({ title: t('success'), description: t('templateSaved') });
        logger.info('Template saved', { productId, sectionsCount: sections.length });
      } else {
        throw new Error(result.message || t('saveTemplateFailed'));
      }
    } catch (error) {
      logger.error('Failed to save template', { error });
      toast({
        variant: 'destructive',
        title: t('error'),
        description: error instanceof Error ? error.message : t('saveTemplateFailed'),
      });
    }
  };

  return (
    <div className="container mx-auto p-6 flex gap-6">
      <div className="w-2/3">
        <Card>
          <CardHeader>
            <CardTitle>{t('title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                {sections.map((section, index) => (
                  <div key={section.id} className="flex items-center space-x-2 mb-3">
                    <GripVertical className="h-5 w-5 cursor-move" />
                    {section.type === 'text' && (
                      <Input
                        value={section.content.text || ''}
                        onChange={(e) => updateSection(index, 'text', e.target.value)}
                        placeholder={t('sectionContent')}
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
                      <>
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
                      </>
                    )}
                    {section.type === 'carousel' && (
                      <Input
                        value={section.content.images?.join(',') || ''}
                        onChange={(e) => updateSection(index, 'images', e.target.value.split(',').map((s: string) => s.trim()))}
                        placeholder={t('carouselImages')}
                      />
                    )}
                    {section.type === 'countdown' && (
                      <Input
                        type="datetime-local"
                        value={section.content.endDate ? new Date(section.content.endDate).toISOString().slice(0, 16) : ''}
                        onChange={(e) => updateSection(index, 'endDate', e.target.value)}
                        placeholder={t('countdownEndDate')}
                      />
                    )}
                    {section.type === 'reviews' && (
                      <Input
                        value={section.content.reviews?.length || 0}
                        readOnly
                        placeholder={t('reviewsCount')}
                      />
                    )}
                    <Button type="button" variant="destructive" onClick={() => removeSection(index)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </SortableContext>
            </DndContext>
            <Select onValueChange={(value) => addSection(value)}>
              <SelectTrigger>
                <SelectValue placeholder={t('addSection')} />
              </SelectTrigger>
              <SelectContent>
                {['text', 'image', 'video', 'button', 'carousel', 'countdown', 'reviews'].map((type) => (
                  <SelectItem key={type} value={type}>
                    {t(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button className="mt-4" onClick={saveTemplate}>
              {t('saveTemplate')}
            </Button>
          </CardContent>
        </Card>
      </div>
      <div className="w-1/3">
        <ProductPreview data={previewData} />
      </div>
    </div>
  );
}