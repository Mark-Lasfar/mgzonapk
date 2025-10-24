'use client';

import { useReducer, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useTranslations, useLocale } from 'next-intl';
import { useToast } from '@/components/ui/toast';
import { Steps, Step } from '@/components/ui/steps';
import { formReducer, initialState } from '@/lib/reducer';
import { stepsConfig } from '@/lib/config';
import { useQuery, useMutation } from '@apollo/client/react';
import { CREATE_PRODUCT, UPDATE_PRODUCT } from '@/graphql/product/mutations';
import { GET_SELLER_CONFIGURATIONS, GET_INTEGRATIONS } from '@/graphql/seller/queries';
import { GET_PRODUCTS } from '@/graphql/product/queries';
import BasicInfoSection from './BasicInfoSection';
import PricingSection from './PricingSection';
import WarehousesSection from './WarehousesSection';
import ImagesSection from './ImagesSection';
import DynamicSections from './DynamicSections';
import RelatedProductsSection from './RelatedProductsSection';
import LayoutSettingsSection from './LayoutSettingsSection';
import TranslationsSection from './TranslationsSection';
import ImportSection from './ImportSection';
import DropshippingSection from './DropshippingSection';
import DropshippingImport from './DropshippingImport';
import MetadataSection from './MetadataSection';
import PreviewCard from './PreviewCard';
import StatusCard from './StatusCard';
import PaymentMethodsCard from './PaymentMethodsCard';
import ShippingProvidersCard from './ShippingProvidersCard';
import { ProductFormProps, ProductInput, SellerConfigurationsResponse, IntegrationsResponse, ProductsResponse } from '@/lib/types';

export default function ProductForm({ type, product, productId }: ProductFormProps) {
  const t = useTranslations('Seller.ProductForm');
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const { data: session } = useSession();
  const [state, dispatch] = useReducer(formReducer, initialState);
  const [currentStep, setCurrentStep] = useState(0);

  const { data: configData, loading: configLoading, error: configError } = useQuery<SellerConfigurationsResponse>(GET_SELLER_CONFIGURATIONS, {
    variables: { sellerId: session?.user?.id },
    skip: !session?.user?.id,
  });

  const { data: integrationsData, loading: integrationsLoading, error: integrationsError } = useQuery<IntegrationsResponse>(GET_INTEGRATIONS, {
    variables: { sellerId: session?.user?.id, sandboxMode: state.sandboxMode },
    skip: !session?.user?.id,
  });

  const { data: productsData, loading: productsLoading, error: productsError } = useQuery<ProductsResponse>(GET_PRODUCTS, {
    variables: { sellerId: session?.user?.id, excludeProductId: productId },
    skip: !session?.user?.id,
  });

  const [createProduct, { loading: createLoading }] = useMutation(CREATE_PRODUCT);
  const [updateProduct, { loading: updateLoading }] = useMutation(UPDATE_PRODUCT);

  useEffect(() => {
    if (configData?.sellerConfigurations) {
      dispatch({
        type: 'SET_CONFIGURATIONS',
        payload: configData.sellerConfigurations,
      });
    } else if (configError) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: t('configFetchFailed'),
      });
    }
  }, [configData, configError, t]);

  useEffect(() => {
    if (integrationsData?.integrations) {
      dispatch({
        type: 'SET_INTEGRATIONS',
        payload: integrationsData.integrations,
      });
    } else if (integrationsError) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: t('integrationsFetchFailed'),
      });
    }
  }, [integrationsData, integrationsError, t]);

  useEffect(() => {
    if (productsData?.products) {
      dispatch({
        type: 'SET_RELATED_PRODUCTS',
        payload: productsData.products,
      });
    } else if (productsError) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: t('productsFetchFailed'),
      });
    }
  }, [productsData, productsError, t]);

  useEffect(() => {
    if (product) {
      dispatch({
        type: 'SET_FORM_VALUES',
        payload: product,
      });
    }
  }, [product]);

  const handleSubmit = async () => {
    if (!session?.user?.id) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: t('sessionNotFound'),
      });
      return;
    }

    // Validate required fields
    const { name, pricing, warehouseData } = state.formValues;
    if (!name || !pricing.basePrice || !pricing.finalPrice || !pricing.currency) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: t('requiredFieldsMissing'),
      });
      return;
    }
    // Validate SKU in warehouseData if present
    if (warehouseData && warehouseData.length > 0 && !warehouseData.every(w => w.sku)) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: t('skuMissingInWarehouseData'),
      });
      return;
    }

    try {
      const input: ProductInput = {
        ...state.formValues,
        images: state.images,
        pricing: {
          ...state.formValues.pricing,
          basePrice: state.formValues.pricing.basePrice || state.formValues.price,
          finalPrice: state.formValues.pricing.finalPrice || state.formValues.price,
          currency: state.currency,
          markup: state.formValues.pricing.markup || 0,
          profit: state.formValues.pricing.profit || 0,
          commission: state.formValues.pricing.commission || 0,
          discount: state.formValues.pricing.discount || { type: 'none' },
        },
        sections: state.sections,
        sellerId: session.user.id,
        tags: state.formValues.tags || [],
        translations: state.formValues.translations || [{ locale, name: '', description: '' }],
        metadata: state.formValues.metadata || {},
      };

      const result = type === 'Create'
        ? await createProduct({ variables: { input } })
        : await updateProduct({ variables: { id: productId, input } });

      if (result.data) {
        toast({
          title: t('success'),
          description: t(type === 'Create' ? 'productCreatedSuccessfully' : 'productUpdatedSuccessfully'),
        });
        dispatch({ type: 'CLEAR_PREVIEW_URLS' });
        router.push('/seller/dashboard/products');
        router.refresh();
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: error instanceof Error ? error.message : t('unexpectedError'),
      });
    }
  };

  return (
    <div className="container mx-auto p-6" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      {(configLoading || integrationsLoading || productsLoading) && (
        <div className="text-center py-6">{t('loading')}</div>
      )}
      <div className="flex justify-end mb-4">
        <select
          value={state.sandboxMode.toString()}
          onChange={(e) => dispatch({ type: 'SET_SANDBOX_MODE', payload: e.target.value === 'true' })}
          aria-label={t('environment')}
          className="w-[180px] border rounded p-2"
        >
          <option value="false">{t('live')}</option>
          <option value="true">{t('sandbox')}</option>
        </select>
      </div>
      <Steps current={currentStep} onChange={setCurrentStep}>
        {stepsConfig.map((step) => (
          <Step key={step.key} title={t(step.title)} />
        ))}
      </Steps>
      <div className="flex gap-6 mt-6">
        <div className="w-2/3">
          {currentStep === 0 && <BasicInfoSection state={state} dispatch={dispatch} />}
          {currentStep === 1 && <PricingSection state={state} dispatch={dispatch} />}
          {currentStep === 2 && <WarehousesSection state={state} dispatch={dispatch} />}
          {currentStep === 3 && <ImagesSection state={state} dispatch={dispatch} />}
          {currentStep === 4 && <DynamicSections state={state} dispatch={dispatch} />}
          {currentStep === 5 && <RelatedProductsSection state={state} dispatch={dispatch} />}
          {currentStep === 6 && <LayoutSettingsSection state={state} dispatch={dispatch} />}
          {currentStep === 7 && <TranslationsSection state={state} dispatch={dispatch} />}
          {currentStep === 8 && <ImportSection state={state} dispatch={dispatch} />}
          {currentStep === 9 && (
            <>
              <DropshippingSection state={state} dispatch={dispatch} />
              <DropshippingImport state={state} dispatch={dispatch} />
            </>
          )}
          {currentStep === 10 && <MetadataSection state={state} dispatch={dispatch} />}
          <div className="flex justify-between mt-6">
            <button
              type="button"
              onClick={() => setCurrentStep(currentStep - 1)}
              disabled={currentStep === 0 || createLoading || updateLoading}
              className="px-4 py-2 border rounded"
            >
              {t('previous')}
            </button>
            {currentStep < stepsConfig.length ? (
              <button
                type="button"
                onClick={() => setCurrentStep(currentStep + 1)}
                disabled={createLoading || updateLoading}
                className="px-4 py-2 bg-blue-500 text-white rounded"
              >
                {t('next')}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={createLoading || updateLoading}
                className="px-4 py-2 bg-green-500 text-white rounded"
              >
                {createLoading || updateLoading ? t('submitting') : t('submit')}
              </button>
            )}
          </div>
        </div>
        <div className="w-1/3">
          <PreviewCard state={state} />
          <StatusCard state={state} dispatch={dispatch} />
          <PaymentMethodsCard state={state} />
          <ShippingProvidersCard state={state} />
        </div>
      </div>
    </div>
  );
}