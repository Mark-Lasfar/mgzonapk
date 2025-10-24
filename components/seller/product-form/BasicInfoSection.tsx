// /home/mark/Music/my-nextjs-project-clean/components/seller/product-form/BasicInfoSection.tsx
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { FormField } from '@/components/ui/form';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toSlug } from '@/lib/utils';
import { State, Action } from '@/lib/types';

interface BasicInfoSectionProps {
  state: State;
  dispatch: React.Dispatch<Action>;
}

export default function BasicInfoSection({ state, dispatch }: BasicInfoSectionProps) {
  const t = useTranslations('Seller.ProductForm');

  return (
    <Card>
      <CardHeader>
        <h2>{t('basicInformation')}</h2>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <FormField
          name="name"
          render={({ field }) => (
            <div>
              <label>{t('productName')}</label>
              <Input
                placeholder={t('namePlaceholder')}
                value={state.formValues.name}
                onChange={(e) => {
                  dispatch({ type: 'SET_FORM_VALUES', payload: { ...state.formValues, name: e.target.value, slug: toSlug(e.target.value) } });
                }}
                aria-label={t('productName')}
              />
            </div>
          )}
        />
        <FormField
          name="slug"
          render={({ field }) => (
            <div>
              <label>{t('slug')}</label>
              <div className="flex gap-2">
                <Input
                  placeholder={t('slugPlaceholder')}
                  value={state.formValues.slug}
                  onChange={(e) => dispatch({ type: 'SET_FORM_VALUES', payload: { ...state.formValues, slug: e.target.value } })}
                  aria-label={t('slug')}
                />
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'SET_FORM_VALUES', payload: { ...state.formValues, slug: toSlug(state.formValues.name) } })}
                  className="px-4 py-2 border rounded"
                >
                  {t('generate')}
                </button>
              </div>
            </div>
          )}
        />
        <FormField
          name="category"
          render={({ field }) => (
            <div>
              <label>{t('category')}</label>
              <Select
                value={state.formValues.category}
                onValueChange={(value) => dispatch({ type: 'SET_FORM_VALUES', payload: { ...state.formValues, category: value } })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('categoryPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {state.categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        />
        <FormField
          name="brand"
          render={({ field }) => (
            <div>
              <label>{t('brand')}</label>
              <Input
                placeholder={t('brandPlaceholder')}
                value={state.formValues.brand}
                onChange={(e) => dispatch({ type: 'SET_FORM_VALUES', payload: { ...state.formValues, brand: e.target.value } })}
                aria-label={t('brand')}
              />
            </div>
          )}
        />
        <FormField
          name="description"
          render={({ field }) => (
            <div className="md:col-span-2">
              <label>{t('description')}</label>
              <Textarea
                placeholder={t('descriptionPlaceholder')}
                className="min-h-[150px]"
                value={state.formValues.description}
                onChange={(e) => dispatch({ type: 'SET_FORM_VALUES', payload: { ...state.formValues, description: e.target.value } })}
                aria-label={t('description')}
              />
            </div>
          )}
        />
        <div className="flex items-center space-x-2">
          <Switch
            checked={state.formValues.featured}
            onCheckedChange={(value) => dispatch({ type: 'SET_FORM_VALUES', payload: { ...state.formValues, featured: value } })}
            aria-label={t('featured')}
          />
          <label>{t('featured')}</label>
        </div>
        <div className="flex items-center space-x-2">
          <Switch
            checked={state.formValues.isPublished}
            onCheckedChange={(value) => dispatch({ type: 'SET_FORM_VALUES', payload: { ...state.formValues, isPublished: value } })}
            aria-label={t('isPublished')}
          />
          <label>{t('isPublished')}</label>
        </div>
      </CardContent>
    </Card>
  );
}