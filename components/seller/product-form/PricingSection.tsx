// /home/mark/Music/my-nextjs-project-clean/components/seller/product-form/PricingSection.tsx
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { State, Action } from '@/lib/types';
import { calculatePricing } from '@/lib/utils';

interface PricingSectionProps {
  state: State;
  dispatch: React.Dispatch<Action>;
}

export default function PricingSection({ state, dispatch }: PricingSectionProps) {
  const t = useTranslations('Seller.ProductForm');
  const pricing = calculatePricing(
    Number(state.formValues.price) || 0,
    Number(state.formValues.listPrice) || 0,
    Number(state.formValues.pricing?.markup) || 30,
    state.formValues.pricing?.discount,
    state.currency
  );

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
          />
          <p className="text-sm text-muted-foreground">
            {t('yourCost')}: {pricing.currency} {Number(state.formValues.price).toFixed(2)}
            <br />
            <small>{t('commission')}: {pricing.currency} {pricing.commission}</small>
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
          />
          <p className="text-sm text-muted-foreground">
            {t('msrp')}: {pricing.currency} {Number(state.formValues.listPrice).toFixed(2)}
            <br />
            <small>{t('suggestedMarkup')}: {pricing.suggestedMarkup}%</small>
          </p>
        </div>
        <div>
          <label>{t('markup')}</label>
          <Input
            type="number"
            step="0.1"
            min="0"
            max="100"
            value={state.formValues.pricing?.markup || pricing.suggestedMarkup}
            onChange={(e) => {
              const value = parseFloat(e.target.value) || 30;
              dispatch({
                type: 'SET_FORM_VALUES',
                payload: { ...state.formValues, pricing: { ...state.formValues.pricing, markup: value } },
              });
            }}
            aria-label={t('markup')}
          />
          <p className="text-sm text-muted-foreground">
            {t('finalPrice')}: {pricing.currency} {pricing.finalPrice}
            <br />
            <small>{t('estProfit')}: {pricing.currency} {pricing.profit}</small>
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
              />
            </div>
          </>
        )}
        <div>
          <label>{t('currency')}</label>
          <Select
            value={state.currency}
            onValueChange={(value) => dispatch({ type: 'SET_CURRENCY', payload: value })}
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
    </Card>
  );
}