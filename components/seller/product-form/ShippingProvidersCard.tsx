import { useTranslations } from 'next-intl';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { State } from '@/lib/types';

interface ShippingProvidersCardProps {
  state: State;
}

export default function ShippingProvidersCard({ state }: ShippingProvidersCardProps) {
  const t = useTranslations('Seller.ProductForm');

  return (
    <Card className="mt-4">
      <CardHeader>
        <h2>{t('shippingProviders')}</h2>
      </CardHeader>
      <CardContent>
        {state.shippingProviders.length === 0 ? (
          <p className="text-muted-foreground">{t('noShippingProviders')}</p>
        ) : (
          <ul className="list-disc pl-5">
            {state.shippingProviders.map((provider) => (
              <li key={provider.id}>{provider.name}</li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}