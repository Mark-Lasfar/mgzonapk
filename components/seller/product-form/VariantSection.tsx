import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PlusCircle, Trash2 } from 'lucide-react';
import { State, Action } from '@/lib/types';

interface VariantSectionProps {
  state: State;
  dispatch: React.Dispatch<Action>;
  warehouseIndex: number;
}

export default function VariantSection({ state, dispatch, warehouseIndex }: VariantSectionProps) {
  const t = useTranslations('Seller.ProductForm');

  const addVariant = () => {
    const warehouseData = [...(state.formValues.warehouseData || [])];
    const variants = warehouseData[warehouseIndex]?.variants || [];
    variants.push({
      id: Math.random().toString(36).substr(2, 9),
      sku: '',
      barcode: '',
      attributes: { color: '', size: '' },
      priceAdjustment: 0,
      stock: 0,
    });
    warehouseData[warehouseIndex] = { ...warehouseData[warehouseIndex], variants };
    dispatch({ type: 'SET_FORM_VALUES', payload: { ...state.formValues, warehouseData } });
  };

  const updateVariant = (variantIndex: number, field: string, value: any) => {
    const warehouseData = [...(state.formValues.warehouseData || [])];
    const variants = [...(warehouseData[warehouseIndex]?.variants || [])];
    variants[variantIndex] = { ...variants[variantIndex], [field]: value };
    warehouseData[warehouseIndex] = { ...warehouseData[warehouseIndex], variants };
    dispatch({ type: 'SET_FORM_VALUES', payload: { ...state.formValues, warehouseData } });
  };

  const removeVariant = (variantIndex: number) => {
    const warehouseData = [...(state.formValues.warehouseData || [])];
    const variants = warehouseData[warehouseIndex]?.variants.filter((_, i) => i !== variantIndex) || [];
    warehouseData[warehouseIndex] = { ...warehouseData[warehouseIndex], variants };
    dispatch({ type: 'SET_FORM_VALUES', payload: { ...state.formValues, warehouseData } });
  };

  return (
    <Card className="mt-4">
      <CardContent>
        <h3 className="font-semibold mb-4">{t('variants')}</h3>
        {state.formValues.warehouseData?.[warehouseIndex]?.variants?.map((variant, variantIndex) => (
          <div key={variant.id} className="grid gap-4 md:grid-cols-4 mb-4">
            <div>
              <label>{t('variantSku')}</label>
              <Input
                value={variant.sku}
                onChange={(e) => updateVariant(variantIndex, 'sku', e.target.value)}
                placeholder={t('skuPlaceholder')}
                aria-label={t('variantSku')}
              />
            </div>
            <div>
              <label>{t('barcode')}</label>
              <Input
                value={variant.barcode}
                onChange={(e) => updateVariant(variantIndex, 'barcode', e.target.value)}
                placeholder={t('barcodePlaceholder')}
                aria-label={t('barcode')}
              />
            </div>
            <div>
              <label>{t('color')}</label>
              <Input
                value={variant.attributes.color}
                onChange={(e) => updateVariant(variantIndex, 'attributes', { ...variant.attributes, color: e.target.value })}
                placeholder={t('colorPlaceholder')}
                aria-label={t('color')}
              />
            </div>
            <div>
              <label>{t('size')}</label>
              <Input
                value={variant.attributes.size}
                onChange={(e) => updateVariant(variantIndex, 'attributes', { ...variant.attributes, size: e.target.value })}
                placeholder={t('sizePlaceholder')}
                aria-label={t('size')}
              />
            </div>
            <div>
              <label>{t('priceAdjustment')}</label>
              <Input
                type="number"
                step="0.01"
                value={variant.priceAdjustment}
                onChange={(e) => updateVariant(variantIndex, 'priceAdjustment', parseFloat(e.target.value) || 0)}
                placeholder={t('priceAdjustmentPlaceholder')}
                aria-label={t('priceAdjustment')}
              />
            </div>
            <div>
              <label>{t('stock')}</label>
              <Input
                type="number"
                value={variant.stock}
                onChange={(e) => updateVariant(variantIndex, 'stock', parseInt(e.target.value) || 0)}
                placeholder={t('stockPlaceholder')}
                aria-label={t('stock')}
              />
            </div>
            <Button
              type="button"
              variant="destructive"
              onClick={() => removeVariant(variantIndex)}
              className="mt-6"
              aria-label={t('removeVariant')}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={addVariant}
          aria-label={t('addVariant')}
        >
          <PlusCircle className="mr-2 h-4 w-4" /> {t('addVariant')}
        </Button>
      </CardContent>
    </Card>
  );
}