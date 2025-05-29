'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { updateSellerSettings } from '@/lib/actions/seller.actions';
import { useToast } from '@/hooks/use-toast';

export default function SettingsPage() {
  const t = useTranslations('Settings');
  const { data: session, status } = useSession();
  const { toast } = useToast();
  const [seller, setSeller] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    businessName: '',
    customSiteUrl: '',
    description: '',
    phone: '',
    address: { street: '', city: '', state: '', country: '', postalCode: '' },
    bankInfo: { accountName: '', accountNumber: '', bankName: '', swiftCode: '' },
    notifications: {
      email: true,
      sms: false,
      orderUpdates: true,
      marketingEmails: false,
      pointsNotifications: true,
    },
    display: {
      showRating: true,
      showContactInfo: true,
      showMetrics: true,
      showPointsBalance: true,
    },
    security: { twoFactorAuth: false, loginNotifications: true },
    customSite: { theme: 'default', primaryColor: '#000000', bannerImage: '' },
  });
  const [bannerFile, setBannerFile] = useState<File | null>(null);

  useEffect(() => {
    const fetchSeller = async () => {
      if (status !== 'authenticated' || session?.user?.role !== 'SELLER') {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const res = await fetch('/api/seller');
        if (!res.ok) throw new Error(t('errors.fetchFailed'));
        const data = await res.json();
        if (!data.success) throw new Error(data.message || t('errors.fetchFailed'));
        setSeller(data.data);
        setFormData({
          businessName: data.data.businessName,
          customSiteUrl: data.data.customSiteUrl || '',
          description: data.data.description || '',
          phone: data.data.phone,
          address: data.data.address,
          bankInfo: data.data.bankInfo,
          notifications: data.data.settings.notifications,
          display: data.data.settings.display,
          security: data.data.settings.security,
          customSite: data.data.settings.customSite,
        });
      } catch (err) {
        setError(t('errors.fetchFailed'));
      } finally {
        setLoading(false);
      }
    };
    fetchSeller();
  }, [t, status, session]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const result = await updateSellerSettings(formData, bannerFile);
      if (!result.success) throw new Error(result.error || t('errors.updateFailed'));
      setSeller({ ...seller, ...result.data });
      toast({ description: t('updateSuccess') });
    } catch (err) {
      setError(t('errors.updateFailed'));
      toast({ description: t('errors.updateFailed'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading' || loading) {
    return <div className="p-6">{t('loading')}</div>;
  }

  if (status === 'unauthenticated') {
    return <div className="p-6">{t('errors.unauthenticated')}</div>;
  }

  if (session?.user?.role !== 'SELLER') {
    return <div className="p-6">{t('errors.accessDenied')}</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      {error && <div className="text-red-500">{error}</div>}
      <form onSubmit={handleSubmit}>
        <Card className="bg-white">
          <CardHeader>
            <CardTitle>{t('businessInfo')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="businessName">{t('businessName')}</Label>
              <Input
                id="businessName"
                value={formData.businessName}
                onChange={(e) =>
                  setFormData({ ...formData, businessName: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="customSiteUrl">{t('customSiteUrl')}</Label>
              <Input
                id="customSiteUrl"
                value={formData.customSiteUrl}
                onChange={(e) =>
                  setFormData({ ...formData, customSiteUrl: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="description">{t('description')}</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="phone">{t('phone')}</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white mt-4">
          <CardHeader>
            <CardTitle>{t('notifications')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>{t('emailNotifications')}</Label>
              <Switch
                checked={formData.notifications.email}
                onCheckedChange={(checked) =>
                  setFormData({
                    ...formData,
                    notifications: { ...formData.notifications, email: checked },
                  })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>{t('smsNotifications')}</Label>
              <Switch
                checked={formData.notifications.sms}
                onCheckedChange={(checked) =>
                  setFormData({
                    ...formData,
                    notifications: { ...formData.notifications, sms: checked },
                  })
                }
              />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white mt-4">
          <CardHeader>
            <CardTitle>{t('customSite')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="theme">{t('theme')}</Label>
              <Input
                id="theme"
                value={formData.customSite.theme}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    customSite: { ...formData.customSite, theme: e.target.value },
                  })
                }
              />
            </div>
            <div>
              <Label htmlFor="primaryColor">{t('primaryColor')}</Label>
              <Input
                id="primaryColor"
                type="color"
                value={formData.customSite.primaryColor}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    customSite: {
                      ...formData.customSite,
                      primaryColor: e.target.value,
                    },
                  })
                }
              />
            </div>
            <div>
              <Label htmlFor="bannerImage">{t('bannerImage')}</Label>
              <Input
                id="bannerImage"
                type="file"
                accept="image/*"
                onChange={(e) =>
                  setBannerFile(e.target.files ? e.target.files[0] : null)
                }
              />
            </div>
          </CardContent>
        </Card>
        <Button type="submit" className="mt-4" disabled={loading}>
          {t('save')}
        </Button>
      </form>
    </div>
  );
}