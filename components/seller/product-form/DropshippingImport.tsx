// /components/seller/product-form/DropshippingImport.tsx
import { useTranslations } from 'next-intl';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { useMutation } from '@apollo/client/react';
import { IMPORT_DROPSHIPPING_PRODUCT } from '@/graphql/product/mutations';
import { State, Action, ImportDropshippingProductResponse } from '@/lib/types';

interface DropshippingImportProps {
  state: State;
  dispatch: React.Dispatch<Action>;
}

export default function DropshippingImport({ state, dispatch }: DropshippingImportProps) {
  const t = useTranslations('Seller.ProductForm');
  const { toast } = useToast();
  const [importProduct, { loading }] = useMutation<ImportDropshippingProductResponse>(IMPORT_DROPSHIPPING_PRODUCT);

  const handleImport = async () => {
    if (!state.formValues.dropshipping?.provider || !state.formValues.dropshipping?.externalProductId) {
      toast({ variant: 'destructive', title: t('error'), description: t('missingDropshippingData') });
      return;
    }

    const providerExists = state.dropshippingProviders.some(
      (provider) => provider.id === state.formValues.dropshipping?.provider
    );
    if (!providerExists) {
      toast({ variant: 'destructive', title: t('error'), description: t('invalidProvider') });
      return;
    }

    try {
      const { data } = await importProduct({
        variables: {
          providerId: state.formValues.dropshipping.provider,
          externalProductId: state.formValues.dropshipping.externalProductId,
        },
      });

      if (data?.importDropshippingProduct) {
        dispatch({
          type: 'SET_FORM_VALUES',
          payload: {
            ...state.formValues,
            name: data.importDropshippingProduct.name,
            description: data.importDropshippingProduct.description,
            price: data.importDropshippingProduct.price,
            images: data.importDropshippingProduct.images,
            currency: data.importDropshippingProduct.currency,
            countInStock: data.importDropshippingProduct.availability === 'in_stock' ? 1 : 0,
            dropshipping: {
              ...state.formValues.dropshipping,
              externalSku: data.importDropshippingProduct.sku,
            },
          },
        });
        dispatch({ type: 'SET_IMAGES', payload: data.importDropshippingProduct.images });
        dispatch({ type: 'SET_CURRENCY', payload: data.importDropshippingProduct.currency });
        toast({
          description: t('dropshippingProductImported', {
            name: data.importDropshippingProduct.name,
            availability: data.importDropshippingProduct.availability,
          }),
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('importFailed');
      toast({
        variant: 'destructive',
        title: t('error'),
        description: errorMessage.includes('Integration not found') 
          ? t('integrationNotFound')
          : errorMessage.includes('Integration not connected')
          ? t('integrationNotConnected')
          : errorMessage.includes('INVALID_INTEGRATION_TYPE')
          ? t('invalidIntegrationType')
          : errorMessage,
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <h2>{t('dropshippingImport')}</h2>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <Input
            placeholder={t('externalProductId')}
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
          />
          <Button
            onClick={handleImport}
            disabled={loading || !state.formValues.dropshipping?.provider || !state.formValues.dropshipping?.externalProductId}
            aria-label={t('importDropshippingProduct')}
          >
            {loading ? t('importing') : t('importDropshippingProduct')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}