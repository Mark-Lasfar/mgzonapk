import { useTranslations } from 'next-intl';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { State, Action } from '@/lib/types';

interface StatusCardProps {
  state: State;
  dispatch: React.Dispatch<Action>;
}

export default function StatusCard({ state, dispatch }: StatusCardProps) {
  const t = useTranslations('Seller.ProductForm');

  return (
    <Card className="mt-4">
      <CardHeader>
        <h2>{t('status')}</h2>
      </CardHeader>
      <CardContent>
        <div className="flex items-center space-x-2 mb-4">
          <Switch
            checked={state.formValues.isPublished}
            onCheckedChange={(value) =>
              dispatch({ type: 'SET_FORM_VALUES', payload: { ...state.formValues, isPublished: value } })
            }
            aria-label={t('isPublished')}
          />
          <label>{t('isPublished')}</label>
        </div>
        <div className="flex items-center space-x-2">
          <Switch
            checked={state.formValues.featured}
            onCheckedChange={(value) =>
              dispatch({ type: 'SET_FORM_VALUES', payload: { ...state.formValues, featured: value } })
            }
            aria-label={t('featured')}
          />
          <label>{t('featured')}</label>
        </div>
      </CardContent>
    </Card>
  );
}