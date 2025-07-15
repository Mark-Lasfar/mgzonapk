'use client';
import { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface TemplateBuilderProps {
  template: any;
  onSave: (template: any) => void;
}

export default function TemplateBuilder({ template, onSave }: TemplateBuilderProps) {
  const t = useTranslations('TemplateBuilder');
  const [layout, setLayout] = useState(template?.layout || []);
  const [colors, setColors] = useState(
    template?.colors || { primary: '#ff6600', secondary: '#333' }
  );
  const [heroConfig, setHeroConfig] = useState(template?.heroConfig || {});

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;
    const newLayout = [...layout];
    const [reorderedItem] = newLayout.splice(result.source.index, 1);
    newLayout.splice(result.destination.index, 0, reorderedItem);
    setLayout(newLayout);
  };

  const handleSave = () => {
    const updatedTemplate = {
      ...template,
      layout,
      colors,
      heroConfig,
    };
    onSave(updatedTemplate);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{t('layout')}</h2>
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="layout">
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="min-h-[100px] border rounded p-4"
              >
                {layout.map((section: string, index: number) => (
                  <Draggable key={section} draggableId={section} index={index}>
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className="p-2 bg-gray-100 rounded mb-2 flex items-center"
                      >
                        <span className="mr-2">☰</span> {section}
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>

      <div>
        <h2 className="text-lg font-semibold">{t('colors')}</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>{t('primaryColor')}</Label>
            <Input
              type="color"
              value={colors.primary}
              onChange={(e) => setColors({ ...colors, primary: e.target.value })}
            />
          </div>
          <div>
            <Label>{t('secondaryColor')}</Label>
            <Input
              type="color"
              value={colors.secondary}
              onChange={(e) => setColors({ ...colors, secondary: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold">{t('heroSettings')}</h2>
        <div className="space-y-4">
          <div>
            <Label>{t('heroTitle')}</Label>
            <Input
              value={heroConfig.title || ''}
              onChange={(e) =>
                setHeroConfig({ ...heroConfig, title: e.target.value })
              }
            />
          </div>
          <div>
            <Label>{t('heroSubtitle')}</Label>
            <Input
              value={heroConfig.subtitle || ''}
              onChange={(e) =>
                setHeroConfig({ ...heroConfig, subtitle: e.target.value })
              }
            />
          </div>
        </div>
      </div>

      <Button onClick={handleSave}>{t('save')}</Button>
    </div>
  );
}