// /home/mark/Music/my-nextjs-project-clean/components/seller/product-form/DynamicSections.tsx
'use client';

import { useTranslations } from 'next-intl';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { GripVertical, Trash2 } from 'lucide-react';
import { State, Action, Section } from '@/lib/types';

interface DynamicSectionsProps {
  state: State;
  dispatch: React.Dispatch<Action>;
}

export default function DynamicSections({ state, dispatch }: DynamicSectionsProps) {
  const t = useTranslations('Seller.ProductForm');
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const addSection = (type: string) => {
    const newSection: Section = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      content: {
        text: type === 'text' ? '' : undefined,
        url: type === 'image' || type === 'video' || type === 'button' ? '' : undefined,
        label: type === 'button' ? '' : undefined,
        endDate: type === 'countdown' ? new Date().toISOString() : undefined,
        images: type === 'carousel' ? [] : undefined,
        reviews: type === 'reviews' ? [] : undefined,
      },
      position: state.sections.length,
    };
    dispatch({ type: 'SET_SECTIONS', payload: [...state.sections, newSection] });
  };

  const updateSection = (index: number, field: keyof Section['content'], value: string | string[] | any[]) => {
    const newSections = [...state.sections];
    newSections[index].content[field] = value;
    dispatch({ type: 'SET_SECTIONS', payload: newSections });
  };

  const removeSection = (index: number) => {
    dispatch({ type: 'SET_SECTIONS', payload: state.sections.filter((_, i) => i !== index) });
  };

  const onDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const sourceIndex = state.sections.findIndex((s) => s.id === active.id);
    const destIndex = state.sections.findIndex((s) => s.id === over.id);
    const newSections = [...state.sections];
    const [reorderedItem] = newSections.splice(sourceIndex, 1);
    newSections.splice(destIndex, 0, reorderedItem);
    newSections.forEach((section, idx) => (section.position = idx));
    dispatch({ type: 'SET_SECTIONS', payload: newSections });
  };

  return (
    <Card>
      <CardHeader>
        <h2>{t('dynamicSections')}</h2>
      </CardHeader>
      <CardContent>
        <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd} sensors={sensors}>
          <SortableContext items={state.sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            {state.sections.map((section, index) => (
              <div key={section.id} className="flex items-center space-x-2 mb-3">
                <GripVertical className="h-5 w-5 cursor-move" aria-label={t('dragHandle')} />
                {section.type === 'text' && (
                  <Input
                    value={section.content.text || ''}
                    onChange={(e) => updateSection(index, 'text', e.target.value)}
                    placeholder={t('sectionContent')}
                    aria-label={t('textSection')}
                  />
                )}
                {section.type === 'image' && (
                  <Input
                    value={section.content.url || ''}
                    onChange={(e) => updateSection(index, 'url', e.target.value)}
                    placeholder={t('imageUrl')}
                    aria-label={t('imageSection')}
                  />
                )}
                {section.type === 'video' && (
                  <Input
                    value={section.content.url || ''}
                    onChange={(e) => updateSection(index, 'url', e.target.value)}
                    placeholder={t('videoUrl')}
                    aria-label={t('videoSection')}
                  />
                )}
                {section.type === 'button' && (
                  <>
                    <Input
                      value={section.content.label || ''}
                      onChange={(e) => updateSection(index, 'label', e.target.value)}
                      placeholder={t('buttonLabel')}
                      aria-label={t('buttonLabel')}
                    />
                    <Input
                      value={section.content.url || ''}
                      onChange={(e) => updateSection(index, 'url', e.target.value)}
                      placeholder={t('buttonUrl')}
                      aria-label={t('buttonUrl')}
                    />
                  </>
                )}
                {section.type === 'carousel' && (
                  <Input
                    value={section.content.images?.join(',') || ''}
                    onChange={(e) => updateSection(index, 'images', e.target.value.split(',').map((s: string) => s.trim()))}
                    placeholder={t('carouselImages')}
                    aria-label={t('carouselSection')}
                  />
                )}
                {section.type === 'countdown' && (
                  <Input
                    type="datetime-local"
                    value={section.content.endDate ? new Date(section.content.endDate).toISOString().slice(0, 16) : ''}
                    onChange={(e) => updateSection(index, 'endDate', e.target.value)}
                    placeholder={t('countdownEndDate')}
                    aria-label={t('countdownSection')}
                  />
                )}
                {section.type === 'reviews' && (
                  <Input
                    value={section.content.reviews?.length.toString() || '0'}
                    readOnly
                    placeholder={t('reviewsCount')}
                    aria-label={t('reviewsSection')}
                  />
                )}
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => removeSection(index)}
                  aria-label={t('deleteSection')}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </SortableContext>
        </DndContext>
        <Select onValueChange={addSection} aria-label={t('addSection')}>
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
      </CardContent>
    </Card>
  );
}