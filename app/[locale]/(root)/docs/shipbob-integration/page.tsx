import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ShipBobIntegrationDocs() {
  const t = useTranslations('Docs');

  return (
    <div className="container mx-auto">
      <h1 className="text-3xl font-bold mb-6">{t('shipbob.title')}</h1>
      <Card>
        <CardHeader>
          <CardTitle>{t('shipbob.connect')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4">{t('shipbob.description')}</p>
          <ol className="list-decimal pl-6 mb-4">
            <li>{t('shipbob.step1')}</li>
            <li>{t('shipbob.step2')}</li>
            <li>{t('shipbob.step3')}</li>
            <li>{t('shipbob.step4')}</li>
          </ol>
          <h2 className="text-xl font-semibold mb-2">{t('benefits.title')}</h2>
          <ul className="list-disc pl-6">
            <li>{t('benefits.fastShipping')}</li>
            <li>{t('benefits.realTime')}</li>
            <li>{t('benefits.costSavings')}</li>
            <li>{t('benefits.scalability')}</li>
            <li>{t('benefits.support')}</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}