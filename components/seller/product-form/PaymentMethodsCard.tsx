// /home/mark/Music/my-nextjs-project-clean/components/seller/product-form/PaymentMethodsCard.tsx
import { useTranslations } from 'next-intl';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { State } from '@/lib/types';

interface PaymentMethodsCardProps {
  state: State;
}

export default function PaymentMethodsCard({ state }: PaymentMethodsCardProps) {
  const t = useTranslations('Seller.ProductForm');

  return (
    <Card className="mt-4">
      <CardHeader>
        <h2>{t('paymentMethods')}</h2>
      </CardHeader>
      <CardContent>
        {state.paymentMethods.length === 0 ? (
          <p className="text-muted-foreground">{t('noPaymentMethods')}</p>
        ) : (
          <ul className="list-disc pl-5">
            {state.paymentMethods.map((method) => (
              <li key={method.id}>{method.name}</li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}