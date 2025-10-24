import { useTranslations } from 'next-intl';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { useMutation } from '@apollo/client/react';
import Image from 'next/image';
import { State, Action } from '@/lib/types';
import VariantSection from './VariantSection';
import { ADD_INTEGRATION } from '@/graphql/seller/mutations';
import { useToast } from '@/components/ui/toast';
import { useSession } from 'next-auth/react';

interface WarehousesSectionProps {
  state: State;
  dispatch: React.Dispatch<Action>;
}

export default function WarehousesSection({ state, dispatch }: WarehousesSectionProps) {
  const t = useTranslations('Seller.ProductForm');
  const router = useRouter();
  const { toast } = useToast();
  const { data: session } = useSession();
  const [addIntegration, { loading: addIntegrationLoading }] = useMutation(ADD_INTEGRATION);

  const handleAddWarehouse = async () => {
    if (!session?.user?.id) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: t('sessionNotFound'),
      });
      return;
    }

    try {
      await addIntegration({
        variables: {
          sellerId: session.user.id,
          input: { type: 'warehouse', provider: 'new-warehouse', settings: {} },
        },
      });
      toast({ description: t('warehouseAdded') });
      router.refresh();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: t('addWarehouseFailed'),
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <h2>{t('warehouses')}</h2>
      </CardHeader>
      <CardContent>
        {state.isLoadingIntegrations ? (
          <div className="text-center py-6">{t('loading')}</div>
        ) : state.warehouses.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-muted-foreground mb-4">{t('noWarehousesActivated')}</p>
            <Button
              onClick={() => router.push('/seller/dashboard/integrations')}
              variant="outline"
              aria-label={t('goToIntegrations')}
            >
              {t('goToIntegrations')}
            </Button>
            <Button
              onClick={handleAddWarehouse}
              variant="outline"
              disabled={addIntegrationLoading}
              aria-label={t('addWarehouse')}
              className="ml-4"
            >
              {addIntegrationLoading ? t('adding') : t('addWarehouse')}
            </Button>
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {state.warehouses.map((warehouse, index) => (
                <Card key={warehouse.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      {warehouse.logoUrl ? (
                        <Image
                          src={warehouse.logoUrl}
                          alt={`${warehouse.provider} logo`}
                          width={40}
                          height={40}
                          className="object-contain"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center">
                          <span className="text-sm">{warehouse.provider[0]}</span>
                        </div>
                      )}
                      <div>
                        <h3 className="font-semibold">{warehouse.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {warehouse.provider} - {warehouse.location || 'Unknown'}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant={state.formValues.warehouseData?.[index]?.warehouseId === warehouse.id ? 'default' : 'outline'}
                      className="w-full mt-4"
                      onClick={() => {
                        const warehouseData = state.formValues.warehouseData || [];
                        warehouseData[index] = {
                          warehouseId: warehouse.id,
                          provider: warehouse.provider,
                          location: warehouse.location || 'Unknown',
                          sku: '',
                          quantity: 0,
                          minimumStock: 5,
                          reorderPoint: 10,
                          variants: [],
                        };
                        dispatch({ type: 'SET_FORM_VALUES', payload: { ...state.formValues, warehouseData } });
                      }}
                      aria-label={state.formValues.warehouseData?.[index]?.warehouseId === warehouse.id ? t('selected') : t('select')}
                    >
                      {state.formValues.warehouseData?.[index]?.warehouseId === warehouse.id ? t('selected') : t('select')}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
            {state.warehouses.map((warehouse, index) => (
              state.formValues.warehouseData?.[index]?.warehouseId && (
                <VariantSection key={warehouse.id} state={state} dispatch={dispatch} warehouseIndex={index} />
              )
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}