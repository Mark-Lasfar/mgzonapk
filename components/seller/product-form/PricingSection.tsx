'use client';

import { useTranslations } from 'next-intl';
import { useMutation } from '@apollo/client/react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { State, Action } from '@/lib/types';
import { useToast } from '@/components/ui/toast';
import { CALCULATE_PRICING } from '@/graphql/product/queries';
import React from 'react';


interface PricingSectionProps {
  state: State;
  dispatch: React.Dispatch<Action>;
}

export default function PricingSection({ state, dispatch }: PricingSectionProps) {
  const t = useTranslations('Seller.ProductForm');
  const { toast } = useToast();
  const [calculatePricing, { loading, error }] = useMutation(CALCULATE_PRICING);

  const handleCalculatePricing = async () => {
    try {
      const { data } = await calculatePricing({
        variables: {
          basePrice: Number(state.formValues.price) || 0,
          listPrice: Number(state.formValues.listPrice) || 0,
          markup: Number(state.formValues.pricing?.markup) || 30,
          discount: state.formValues.pricing?.discount,
          currency: state.currency,
        },
      });
      return data.calculatePricing;
    } catch (err) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: t('pricingCalculationFailed'),
      });
      return null;
    }
  };

  // نستخدم useEffect لتحديث الأسعار تلقائيًا عند تغيير المدخلات
  React.useEffect(() => {
    handleCalculatePricing().then((pricing) => {
      if (pricing) {
        dispatch({
          type: 'SET_FORM_VALUES',
          payload: {
            ...state.formValues,
            pricing: {
              ...state.formValues.pricing,
              commission: pricing.commission,
              finalPrice: pricing.finalPrice,
              profit: pricing.profit,
              suggestedMarkup: pricing.suggestedMarkup,
            },
          },
        });
      }
    });
  }, [state.formValues.price, state.formValues.listPrice, state.formValues.pricing?.markup, state.formValues.pricing?.discount, state.currency]);

  return (
    <Card>
      <CardHeader>
        <h2>{t('pricing')}</h2>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-3">
        <div>
          <label>{t('basePrice')}</label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={state.formValues.price || ''}
            onChange={(e) => {
              const value = parseFloat(e.target.value) || 0;
              dispatch({
                type: 'SET_FORM_VALUES',
                payload: {
                  ...state.formValues,
                  price: value,
                  listPrice: state.formValues.listPrice < value ? value : state.formValues.listPrice,
                },
              });
            }}
            aria-label={t('basePrice')}
            disabled={loading}
          />
          <p className="text-sm text-muted-foreground">
            {t('yourCost')}: {state.currency} {Number(state.formValues.price).toFixed(2)}
            <br />
            <small>{t('commission')}: {state.currency} {state.formValues.pricing?.commission?.toFixed(2) || '0.00'}</small>
          </p>
        </div>
        <div>
          <label>{t('listPrice')}</label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={state.formValues.listPrice || ''}
            onChange={(e) => {
              const value = parseFloat(e.target.value) || 0;
              dispatch({
                type: 'SET_FORM_VALUES',
                payload: {
                  ...state.formValues,
                  listPrice: value,
                  pricing: {
                    ...state.formValues.pricing,
                    markup: value > state.formValues.price ? ((value - state.formValues.price) / state.formValues.price) * 100 : state.formValues.pricing.markup,
                  },
                },
              });
            }}
            aria-label={t('listPrice')}
            disabled={loading}
          />
          <p className="text-sm text-muted-foreground">
            {t('msrp')}: {state.currency} {Number(state.formValues.listPrice).toFixed(2)}
            <br />
            <small>{t('suggestedMarkup')}: {state.formValues.pricing?.suggestedMarkup?.toFixed(2) || '30.00'}%</small>
          </p>
        </div>
        <div>
          <label>{t('markup')}</label>
          <Input
            type="number"
            step="0.1"
            min="0"
            max="100"
            value={state.formValues.pricing?.markup || '30'}
            onChange={(e) => {
              const value = parseFloat(e.target.value) || 30;
              dispatch({
                type: 'SET_FORM_VALUES',
                payload: { ...state.formValues, pricing: { ...state.formValues.pricing, markup: value } },
              });
            }}
            aria-label={t('markup')}
            disabled={loading}
          />
          <p className="text-sm text-muted-foreground">
            {t('finalPrice')}: {state.currency} {state.formValues.pricing?.finalPrice?.toFixed(2) || '0.00'}
            <br />
            <small>{t('estProfit')}: {state.currency} {state.formValues.pricing?.profit?.toFixed(2) || '0.00'}</small>
          </p>
        </div>
        <div>
          <label>{t('discountType')}</label>
          <Select
            value={state.formValues.pricing?.discount?.type || 'none'}
            onValueChange={(value) =>
              dispatch({
                type: 'SET_FORM_VALUES',
                payload: {
                  ...state.formValues,
                  pricing: { ...state.formValues.pricing, discount: { ...state.formValues.pricing.discount, type: value } },
                },
              })
            }
            disabled={loading}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('selectDiscountType')} />
            </SelectTrigger>
            <SelectContent>
              {['none', 'percentage', 'fixed'].map((type) => (
                <SelectItem key={type} value={type}>
                  {t(type)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {state.formValues.pricing?.discount?.type !== 'none' && (
          <>
            <div>
              <label>{t('discountValue')}</label>
              <Input
                type="number"
                step={state.formValues.pricing?.discount?.type === 'percentage' ? '1' : '0.01'}
                min="0"
                max={state.formValues.pricing?.discount?.type === 'percentage' ? '100' : undefined}
                value={state.formValues.pricing?.discount?.value || ''}
                onChange={(e) => {
                  const value = parseFloat(e.target.value) || 0;
                  dispatch({
                    type: 'SET_FORM_VALUES',
                    payload: {
                      ...state.formValues,
                      pricing: { ...state.formValues.pricing, discount: { ...state.formValues.pricing.discount, value } },
                    },
                  });
                }}
                aria-label={t('discountValue')}
                disabled={loading}
              />
              <p className="text-sm text-muted-foreground">
                {state.formValues.pricing?.discount?.type === 'percentage' ? t('enterPercentage') : t('enterAmount')}
              </p>
            </div>
            <div>
              <label>{t('startDate')}</label>
              <Input
                type="datetime-local"
                value={state.formValues.pricing?.discount?.startDate ? new Date(state.formValues.pricing.discount.startDate).toISOString().slice(0, 16) : ''}
                onChange={(e) =>
                  dispatch({
                    type: 'SET_FORM_VALUES',
                    payload: {
                      ...state.formValues,
                      pricing: { ...state.formValues.pricing, discount: { ...state.formValues.pricing.discount, startDate: e.target.value } },
                    },
                  })
                }
                aria-label={t('startDate')}
                disabled={loading}
              />
            </div>
            <div>
              <label>{t('endDate')}</label>
              <Input
                type="datetime-local"
                value={state.formValues.pricing?.discount?.endDate ? new Date(state.formValues.pricing.discount.endDate).toISOString().slice(0, 16) : ''}
                onChange={(e) =>
                  dispatch({
                    type: 'SET_FORM_VALUES',
                    payload: {
                      ...state.formValues,
                      pricing: { ...state.formValues.pricing, discount: { ...state.formValues.pricing.discount, endDate: e.target.value } },
                    },
                  })
                }
                aria-label={t('endDate')}
                disabled={loading}
              />
            </div>
          </>
        )}
        <div>
          <label>{t('currency')}</label>
          <Select
            value={state.currency}
            onValueChange={(value) => dispatch({ type: 'SET_CURRENCY', payload: value })}
            disabled={loading}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('selectCurrency')} />
            </SelectTrigger>
            <SelectContent>
              {state.supportedCurrencies.map((curr) => (
                <SelectItem key={curr} value={curr}>
                  {curr}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
      {error && (
        <p className="text-red-500 text-sm mt-2">{t('pricingCalculationFailed')}</p>
      )}
    </Card>
  );
}