// /home/mark/Music/my-nextjs-project-clean/components/seller/product-form/DropshippingSection.tsx
import { useTranslations } from 'next-intl';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { State, Action } from '@/lib/types';

interface DropshippingSectionProps {
  state: State;
  dispatch: React.Dispatch<Action>;
}

export default function DropshippingSection({ state, dispatch }: DropshippingSectionProps) {
  const t = useTranslations('Seller.ProductForm');

  return (
    <Card>
      <CardHeader>
        <h2>{t('dropshipping')}</h2>
      </CardHeader>
      <CardContent>
        {state.dropshippingProviders.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-muted-foreground mb-4">{t('noDropshippingProviders')}</p>
            <Button
              onClick={() => window.location.href = '/seller/dashboard/integrations'}
              variant="outline"
              aria-label={t('goToIntegrations')}
            >
              {t('goToIntegrations')}
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t('dropshippingProvider')}</label>
              <Select
                value={state.formValues.dropshipping?.provider || ''}
                onValueChange={(value) =>
                  dispatch({
                    type: 'SET_FORM_VALUES',
                    payload: {
                      ...state.formValues,
                      dropshipping: { ...state.formValues.dropshipping, provider: value },
                    },
                  })
                }
                aria-label={t('dropshippingProvider')}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('selectProvider')} />
                </SelectTrigger>
                <SelectContent>
                  {state.dropshippingProviders.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {state.formValues.dropshipping?.provider && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('externalProductId')}</label>
                  <Input
                    value={state.formValues.dropshipping?.externalProductId || ''}
                    onChange={(e) =>
                      dispatch({
                        type: 'SET_FORM_VALUES',
                        payload: {
                          ...state.formValues,
                          dropshipping: { ...state.formValues.dropshipping, externalProductId: e.target.value },
                        },
                      })
                    }
                    placeholder={t('externalProductIdPlaceholder')}
                    aria-label={t('externalProductId')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('externalSku')}</label>
                  <Input
                    value={state.formValues.dropshipping?.externalSku || ''}
                    onChange={(e) =>
                      dispatch({
                        type: 'SET_FORM_VALUES',
                        payload: {
                          ...state.formValues,
                          dropshipping: { ...state.formValues.dropshipping, externalSku: e.target.value },
                        },
                      })
                    }
                    placeholder={t('externalSkuPlaceholder')}
                    aria-label={t('externalSku')}
                  />
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}