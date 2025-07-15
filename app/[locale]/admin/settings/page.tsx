// import { getAllSettings } from '@/lib/actions/settings.actions';
import SettingForm from './setting-form';
import PointsForm from './points-form';
import IntegrationSettingsForm from './integration-settings-form';
import { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import SettingNav from './setting-nav';
import { getSetting } from '@/lib/actions/setting.actions';

export const metadata: Metadata = {
  title: 'Admin Settings',
};

export default async function SettingPage() {
  const t = useTranslations('admin.settings');
  const settings = await getSetting();

  return (
    <div className="container mx-auto p-6 flex gap-6">
      <aside className="w-64 bg-gray-100 p-4 rounded-lg">
        <SettingNav />
      </aside>
      <main className="flex-1 space-y-6">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <Card>
          <CardHeader>
            <CardTitle>{t('generalSettings')}</CardTitle>
          </CardHeader>
          <CardContent>
            <SettingForm settings={settings} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('pointsSettings')}</CardTitle>
          </CardHeader>
          <CardContent>
            <PointsForm points={settings.points} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('integrationSettings')}</CardTitle>
          </CardHeader>
          <CardContent>
            <IntegrationSettingsForm settings={settings.integrations} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}