// /components/seller/product-form/SupplierSection.tsx
import { useTranslations } from 'next-intl';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { State, Action, Supplier } from '@/lib/types';

interface SupplierSectionProps {
  state: State;
  dispatch: React.Dispatch<Action>;
  suppliers: Supplier[];
}

export default function SupplierSection({ state, dispatch, suppliers }: SupplierSectionProps) {
  const t = useTranslations('Seller.ProductForm');

  return (
    <Card>
      <CardHeader>
        <h2>{t('supplierDetails')}</h2>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">{t('supplier')}</label>
          <Select
            value={state.formValues.dropshipping?.supplierId || ''}
            onValueChange={(value) =>
              dispatch({
                type: 'SET_FORM_VALUES',
                payload: {
                  ...state.formValues,
                  dropshipping: { ...state.formValues.dropshipping, supplierId: value },
                },
              })
            }
            aria-label={t('supplier')}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('selectSupplier')} />
            </SelectTrigger>
            <SelectContent>
              {suppliers.map((supplier) => (
                <SelectItem key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t('purchasePrice')}</label>
          <Input
            type="number"
            value={state.formValues.dropshipping?.purchasePrice || ''}
            onChange={(e) =>
              dispatch({
                type: 'SET_FORM_VALUES',
                payload: {
                  ...state.formValues,
                  dropshipping: { ...state.formValues.dropshipping, purchasePrice: Number(e.target.value) },
                },
              })
            }
            placeholder={t('purchasePricePlaceholder')}
            aria-label={t('purchasePrice')}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t('estimatedDeliveryTime')}</label>
          <Input
            type="number"
            value={state.formValues.dropshipping?.estimatedDeliveryTime || ''}
            onChange={(e) =>
              dispatch({
                type: 'SET_FORM_VALUES',
                payload: {
                  ...state.formValues,
                  dropshipping: { ...state.formValues.dropshipping, estimatedDeliveryTime: Number(e.target.value) },
                },
              })
            }
            placeholder={t('estimatedDeliveryTimePlaceholder')}
            aria-label={t('estimatedDeliveryTime')}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t('supplyType')}</label>
          <Select
            value={state.formValues.dropshipping?.supplyType || ''}
            onValueChange={(value) =>
              dispatch({
                type: 'SET_FORM_VALUES',
                payload: {
                  ...state.formValues,
                  dropshipping: { ...state.formValues.dropshipping, supplyType: value as 'local' | 'international' },
                },
              })
            }
            aria-label={t('supplyType')}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('selectSupplyType')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="local">{t('local')}</SelectItem>
              <SelectItem value="international">{t('international')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t('supplyNotes')}</label>
          <Textarea
            value={state.formValues.dropshipping?.supplyNotes || ''}
            onChange={(e) =>
              dispatch({
                type: 'SET_FORM_VALUES',
                payload: {
                  ...state.formValues,
                  dropshipping: { ...state.formValues.dropshipping, supplyNotes: e.target.value },
                },
              })
            }
            placeholder={t('supplyNotesPlaceholder')}
            aria-label={t('supplyNotes')}
          />
        </div>
      </CardContent>
    </Card>
  );
}
