// /home/mark/Music/my-nextjs-project-clean/components/seller/TemplateSettingsForm.tsx
'use client';

import { useCallback } from 'react';
import { useForm, UseFormReturn, useFieldArray } from 'react-hook-form';
import { TemplateFormData } from '@/lib/types/settings';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import { useToast } from '@/components/ui/toast';
import { Loader2, Trash2 } from 'lucide-react';
import TemplateImporter from './TemplateImporter';
import TemplateLibrary from './TemplateLibrary';
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import sanitizeHtml from 'sanitize-html';

interface Props {
  form: UseFormReturn<TemplateFormData>;
  locale: string;
  storeId: string;
}

const SortableAsset = ({ id, children }: { id: string; children: React.ReactNode }) => {
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

export default function TemplateSettingsForm({ form, locale, storeId }: Props) {
  const t = useTranslations('Template');
  const { toast } = useToast();
  const { fields: assetFields, append, remove, move } = useFieldArray({
    control: form.control,
    name: 'assets',
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = assetFields.findIndex((f) => f.id === active.id);
    const newIndex = assetFields.findIndex((f) => f.id === over.id);
    move(oldIndex, newIndex);
  };

  const onSubmit = async (data: TemplateFormData) => {
    try {
      const sanitizedData = {
        ...data,
        assets: data.assets?.map((asset) => ({
          ...asset,
          url: sanitizeHtml(asset.url, { allowedTags: [] }), // Sanitize URLs if needed
        })),
      };
      const response = await fetch(`/api/stores/${storeId}/template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sanitizedData),
      });
      if (!response.ok) {
        throw new Error(t('errors.saveError'));
      }
      toast({
        title: t('saveSuccess'),
        description: t('templateUpdated'),
      });
    } catch (error) {
      toast({
        title: t('errors.saveError'),
        description: error instanceof Error ? error.message : t('errors.saveError'),
        variant: 'destructive',
      });
    }
  };

  const handleSelectTemplate = (template: TemplateFormData) => {
    form.setValue('assets', template.assets || []);
    form.setValue('colors', template.colors || { primary: '#ff6600', secondary: '#333' });
    form.setValue('heroConfig', template.heroConfig || { title: '', subtitle: '' });
    toast({
      title: t('templateSelected'),
      description: t('templateApplied'),
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <TemplateLibrary storeId={storeId} onSelect={handleSelectTemplate} />
        <FormField
          control={form.control}
          name="colors.primary"
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
          name="colors.secondary"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('secondaryColor')}</FormLabel>
              <FormControl>
                <Input type="color" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="heroConfig.title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('heroTitle')}</FormLabel>
              <FormControl>
                <Input {...field} placeholder={t('enterHeroTitle')} value={field.value || ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="heroConfig.subtitle"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('heroSubtitle')}</FormLabel>
              <FormControl>
                <Input {...field} placeholder={t('enterHeroSubtitle')} value={field.value || ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="space-y-4">
          <h3>{t('assets')}</h3>
          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={assetFields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {assetFields.map((field, index) => (
                  <SortableAsset key={field.id} id={field.id}>
                    <div className="flex items-center space-x-2 border p-2 rounded-md">
                      <span>☰</span>
                      <FormField
                        control={form.control}
                        name={`assets.${index}.name`}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormControl>
                              <Input {...field} placeholder={t('enterSectionName')} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`assets.${index}.url`}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormControl>
                              <Input {...field} placeholder={t('enterSectionUrl')} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button variant="destructive" size="sm" onClick={() => remove(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </SortableAsset>
                ))}
              </div>
            </SortableContext>
          </DndContext>
          <Button
            type="button"
            variant="outline"
            onClick={() => append({ name: `Section ${assetFields.length + 1}`, url: '' })}
          >
            {t('addSection')}
          </Button>
        </div>
        <TemplateImporter
          onImport={(template) => {
            form.setValue('assets', template.assets || []);
            form.setValue('colors', template.colors || { primary: '#ff6600', secondary: '#333' });
            form.setValue('heroConfig', template.heroConfig || { title: '', subtitle: '' });
            toast({
              title: t('templateImported'),
              description: t('templateApplied'),
            });
          }}
          storeId={storeId}
        />
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {t('save')}
        </Button>
      </form>
    </Form>
  );
}