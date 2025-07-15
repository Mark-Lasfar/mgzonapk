'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { updateSellerSettings, addPaymentGateway } from '@/lib/actions/seller.actions';
import { useToast } from '@/components/ui/use-toast';
// import { SettingsFormData, ShippingOption, DiscountOffer } from '@/lib/types';
import { isValidIBAN, isValidSwift } from '@/lib/utils/iban';
import { DiscountOffer, ShippingOption } from '@/lib/types/settings';
import { SettingsFormData } from '@/lib/types';

export default function SettingsPage({ locale }: { locale: string }) {
  const t = useTranslations('Settings');
  const tIntegrations = useTranslations('seller.dashboard.integrations.payments');
  const { data: session, status } = useSession();
  const { toast } = useToast();
  const [seller, setSeller] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<SettingsFormData>({
    businessName: '',
    email: '',
    phone: '',
    description: '',
    customSiteUrl: '',
    address: {
      street: '',
      city: '',
      state: '',
      country: '',
      postalCode: '',
      countryCode: '',
    },
    bankInfo: {
      accountName: '',
      accountNumber: '',
      bankName: '',
      swiftCode: '',
    },
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
    security: {
      twoFactorAuth: false,
      loginNotifications: true,
    },
    customSite: {
      theme: 'default',
      primaryColor: '#000000',
      bannerImage: '',
      customSections: [],
    },
    shippingOptions: [],
    discountOffers: [],
    paymentGateways: [],
  });
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [paymentGateways, setPaymentGateways] = useState<any[]>([]);
  const [availableGateways, setAvailableGateways] = useState<any[]>([]);
  const [availableShippingProviders, setAvailableShippingProviders] = useState<string[]>([]);
  const [selectedGateway, setSelectedGateway] = useState<string>('');
  const [newShippingOption, setNewShippingOption] = useState<ShippingOption>({
    name: '',
    cost: 0,
    estimatedDeliveryDays: 0,
    regions: [],
    isActive: true,
    provider: '',
  });
  const [newDiscountOffer, setNewDiscountOffer] = useState<DiscountOffer>({
    code: '',
    discountType: 'percentage',
    discountValue: 0,
    startDate: new Date().toISOString(),
    endDate: '',
    isActive: true,
    minOrderValue: 0,
  });

  useEffect(() => {
    const fetchSeller = async () => {
      if (status !== 'authenticated' || session?.user?.role !== 'SELLER') {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const res = await fetch(`/api/seller?locale=${locale}`, {
          headers: { Authorization: `Bearer ${session.accessToken}` },
        });
        if (!res.ok) throw new Error(t('errors.fetchFailed'));
        const data = await res.json();
        if (!data.success) throw new Error(data.message || t('errors.fetchFailed'));
        setSeller(data.data);
        setFormData({
          businessName: data.data.businessName || '',
          email: data.data.email || '',
          phone: data.data.phone || '',
          description: data.data.description || '',
          customSiteUrl: data.data.customSiteUrl || '',
          address: {
            street: data.data.address?.street || '',
            city: data.data.address?.city || '',
            state: data.data.address?.state || '',
            country: data.data.address?.country || '',
            postalCode: data.data.address?.postalCode || '',
            countryCode: data.data.address?.countryCode || '',
          },
          bankInfo: {
            accountName: data.data.bankInfo?.accountName || '',
            accountNumber: data.data.bankInfo?.accountNumber || '',
            bankName: data.data.bankInfo?.bankName || '',
            swiftCode: data.data.bankInfo?.swiftCode || '',
          },
          notifications: data.data.settings?.notifications || {
            email: true,
            sms: false,
            orderUpdates: true,
            marketingEmails: false,
            pointsNotifications: true,
          },
          display: data.data.settings?.display || {
            showRating: true,
            showContactInfo: true,
            showMetrics: true,
            showPointsBalance: true,
          },
          security: data.data.settings?.security || {
            twoFactorAuth: false,
            loginNotifications: true,
          },
          customSite: data.data.settings?.customSite || {
            theme: 'default',
            primaryColor: '#000000',
            bannerImage: '',
            customSections: [],
          },
          shippingOptions: data.data.shippingOptions || [],
          discountOffers: data.data.discountOffers || [],
          paymentGateways: data.data.paymentGateways || [],
        });
        setPaymentGateways(data.data.paymentGateways || []);
      } catch (err) {
        setError(t('errors.fetchFailed'));
        toast({ description: t('errors.fetchFailed'), variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };

    const fetchAvailableGateways = async () => {
      try {
        const res = await fetch(`/api/integrations?type=payment&locale=${locale}`);
        if (!res.ok) throw new Error(t('errors.fetchIntegrationsFailed'));
        const data = await res.json();
        if (!data.success) throw new Error(data.message || t('errors.fetchIntegrationsFailed'));
        setAvailableGateways(data.data);
      } catch (err) {
        toast({ description: t('errors.fetchIntegrationsFailed'), variant: 'destructive' });
      }
    };

    const fetchAvailableShippingProviders = async () => {
      try {
        const res = await fetch(`/api/integrations?type=shipping&locale=${locale}`);
        if (!res.ok) throw new Error(t('errors.fetchIntegrationsFailed'));
        const data = await res.json();
        if (!data.success) throw new Error(data.message || t('errors.fetchIntegrationsFailed'));
        setAvailableShippingProviders(data.data.map((provider: any) => provider.providerName));
      } catch (err) {
        toast({ description: t('errors.fetchIntegrationsFailed'), variant: 'destructive' });
      }
    };

    fetchSeller();
    fetchAvailableGateways();
    fetchAvailableShippingProviders();
  }, [t, status, session, locale]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name.includes('.')) {
      const keys = name.split('.');
      setFormData((prev) => {
        let current = { ...prev };
        let temp = current;
        for (let i = 0; i < keys.length - 1; i++) {
          temp = temp[keys[i]];
        }
        temp[keys[keys.length - 1]] = value;
        return { ...current };
      });
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSwitchChange = (name: string, checked: boolean) => {
    if (name.includes('.')) {
      const keys = name.split('.');
      setFormData((prev) => {
        let current = { ...prev };
        let temp = current;
        for (let i = 0; i < keys.length - 1; i++) {
          temp = temp[keys[i]];
        }
        temp[keys[keys.length - 1]] = checked;
        return { ...current };
      });
    } else {
      setFormData((prev) => ({ ...prev, [name]: checked }));
    }
  };

  const handleShippingInputChange = (e: React.ChangeEvent<HTMLInputElement>, index?: number) => {
    const { name, value } = e.target;
    if (index !== undefined) {
      setFormData((prev) => ({
        ...prev,
        shippingOptions: prev.shippingOptions.map((option, i) =>
          i === index ? { ...option, [name]: name === 'cost' || name === 'estimatedDeliveryDays' ? Number(value) : value } : option
        ),
      }));
    } else {
      setNewShippingOption((prev) => ({
        ...prev,
        [name]: name === 'cost' || name === 'estimatedDeliveryDays' ? Number(value) : value,
      }));
    }
  };

  const handleDiscountInputChange = (e: React.ChangeEvent<HTMLInputElement>, index?: number) => {
    const { name, value } = e.target;
    if (index !== undefined) {
      setFormData((prev) => ({
        ...prev,
        discountOffers: prev.discountOffers.map((offer, i) =>
          i === index ? { ...offer, [name]: name === 'discountValue' || name === 'minOrderValue' ? Number(value) : value } : offer
        ),
      }));
    } else {
      setNewDiscountOffer((prev) => ({
        ...prev,
        [name]: name === 'discountValue' || name === 'minOrderValue' ? Number(value) : value,
      }));
    }
  };

  const handleAddShippingOption = () => {
    if (
      newShippingOption.name &&
      newShippingOption.cost >= 0 &&
      newShippingOption.estimatedDeliveryDays > 0 &&
      newShippingOption.provider
    ) {
      setFormData((prev) => ({
        ...prev,
        shippingOptions: [...prev.shippingOptions, newShippingOption],
      }));
      setNewShippingOption({
        name: '',
        cost: 0,
        estimatedDeliveryDays: 0,
        regions: [],
        isActive: true,
        provider: '',
      });
      toast({ description: t('messages.shippingOptionAdded') });
    } else {
      toast({ description: t('errors.invalidShippingOption'), variant: 'destructive' });
    }
  };

  const handleAddDiscountOffer = () => {
    if (
      newDiscountOffer.code &&
      newDiscountOffer.discountValue > 0 &&
      new Date(newDiscountOffer.startDate) <= new Date(newDiscountOffer.endDate || new Date())
    ) {
      setFormData((prev) => ({
        ...prev,
        discountOffers: [...prev.discountOffers, newDiscountOffer],
      }));
      setNewDiscountOffer({
        code: '',
        discountType: 'percentage',
        discountValue: 0,
        startDate: new Date().toISOString(),
        endDate: '',
        isActive: true,
        minOrderValue: 0,
      });
      toast({ description: t('messages.discountOfferAdded') });
    } else {
      toast({ description: t('errors.invalidDiscountOffer'), variant: 'destructive' });
    }
  };

  const handleAddPaymentGateway = async () => {
    if (!selectedGateway || !seller.bankInfo.verified) {
      toast({ description: tIntegrations('errors.selectGateway'), variant: 'destructive' });
      return;
    }
    try {
      setLoading(true);
      const result = await addPaymentGateway(
        session?.user?.id!,
        selectedGateway,
        {},
        selectedGateway === 'mgpay',
        false,
        locale
      );
      if (!result.success) throw new Error(result.error || tIntegrations('errors.addGatewayFailed'));
      toast({ description: tIntegrations('messages.paymentGatewayAdded') });
      const newGateway = { providerName: selectedGateway, verified: true, isDefault: paymentGateways.length === 0 };
      setPaymentGateways((prev) => [...prev, newGateway]);
      setFormData((prev) => ({
        ...prev,
        paymentGateways: [...prev.paymentGateways, newGateway],
      }));
      setSelectedGateway('');
    } catch (err) {
      toast({ description: tIntegrations('errors.addGatewayFailed'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleBankVerification = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/seller/bank/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData.bankInfo,
          sellerId: seller._id,
        }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.message || t('errors.bankVerificationFailed'));
      toast({ description: t('messages.bankInfoVerified') });
      setSeller((prev: any) => ({ ...prev, bankInfo: { ...formData.bankInfo, verified: true } }));
    } catch (err) {
      toast({ description: t('errors.bankVerificationFailed'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

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
    <div className="container mx-auto p-6 space-y-6" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      {error && <div className="text-red-500">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Business Information */}
        <Card>
          <CardHeader>
            <CardTitle>{t('businessInfo')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="businessName">{t('businessName')}</Label>
              <Input
                id="businessName"
                name="businessName"
                value={formData.businessName}
                onChange={handleInputChange}
                required
                className={locale === 'ar' ? 'text-right' : 'text-left'}
              />
            </div>
            <div>
              <Label htmlFor="email">{t('email')}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                required
              />
            </div>
            <div>
              <Label htmlFor="phone">{t('phone')}</Label>
              <Input
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                className={locale === 'ar' ? 'text-right' : 'text-left'}
              />
            </div>
            <div>
              <Label htmlFor="description">{t('description')}</Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                className={locale === 'ar' ? 'text-right' : 'text-left'}
              />
            </div>
            <div>
              <Label htmlFor="customSiteUrl">{t('customSiteUrl')}</Label>
              <Input
                id="customSiteUrl"
                name="customSiteUrl"
                value={formData.customSiteUrl}
                onChange={handleInputChange}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="address.street">{t('street')}</Label>
                <Input
                  id="address.street"
                  name="address.street"
                  value={formData.address.street}
                  onChange={handleInputChange}
                  required
                  className={locale === 'ar' ? 'text-right' : 'text-left'}
                />
              </div>
              <div>
                <Label htmlFor="address.city">{t('city')}</Label>
                <Input
                  id="address.city"
                  name="address.city"
                  value={formData.address.city}
                  onChange={handleInputChange}
                  required
                  className={locale === 'ar' ? 'text-right' : 'text-left'}
                />
              </div>
              <div>
                <Label htmlFor="address.state">{t('state')}</Label>
                <Input
                  id="address.state"
                  name="address.state"
                  value={formData.address.state}
                  onChange={handleInputChange}
                  required
                  className={locale === 'ar' ? 'text-right' : 'text-left'}
                />
              </div>
              <div>
                <Label htmlFor="address.country">{t('country')}</Label>
                <Input
                  id="address.country"
                  name="address.country"
                  value={formData.address.country}
                  onChange={handleInputChange}
                  required
                  className={locale === 'ar' ? 'text-right' : 'text-left'}
                />
              </div>
              <div>
                <Label htmlFor="address.postalCode">{t('postalCode')}</Label>
                <Input
                  id="address.postalCode"
                  name="address.postalCode"
                  value={formData.address.postalCode}
                  onChange={handleInputChange}
                  required
                  className={locale === 'ar' ? 'text-right' : 'text-left'}
                />
              </div>
              <div>
                <Label htmlFor="address.countryCode">{t('countryCode')}</Label>
                <Input
                  id="address.countryCode"
                  name="address.countryCode"
                  value={formData.address.countryCode}
                  onChange={handleInputChange}
                  placeholder="e.g., EG, US, SA"
                  required
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bank Information */}
        <Card>
          <CardHeader>
            <CardTitle>{t('bankInfo')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="bankInfo.accountName">{t('accountName')}</Label>
              <Input
                id="bankInfo.accountName"
                name="bankInfo.accountName"
                value={formData.bankInfo.accountName}
                onChange={handleInputChange}
                required
                className={locale === 'ar' ? 'text-right' : 'text-left'}
              />
            </div>
            <div>
              <Label htmlFor="bankInfo.accountNumber">{t('accountNumber')}</Label>
              <Input
                id="bankInfo.accountNumber"
                name="bankInfo.accountNumber"
                value={formData.bankInfo.accountNumber}
                onChange={handleInputChange}
                required
              />
            </div>
            <div>
              <Label htmlFor="bankInfo.bankName">{t('bankName')}</Label>
              <Input
                id="bankInfo.bankName"
                name="bankInfo.bankName"
                value={formData.bankInfo.bankName}
                onChange={handleInputChange}
                required
                className={locale === 'ar' ? 'text-right' : 'text-left'}
              />
            </div>
            <div>
              <Label htmlFor="bankInfo.swiftCode">{t('swiftCode')}</Label>
              <Input
                id="bankInfo.swiftCode"
                name="bankInfo.swiftCode"
                value={formData.bankInfo.swiftCode}
                onChange={handleInputChange}
                required
              />
            </div>
            <Button
              type="button"
              onClick={handleBankVerification}
              disabled={
                loading ||
                !isValidIBAN(formData.bankInfo.accountNumber) ||
                !isValidSwift(formData.bankInfo.swiftCode)
              }
            >
              {t('verifyBank')}
            </Button>
          </CardContent>
        </Card>

        {/* Shipping Options */}
        <Card>
          <CardHeader>
            <CardTitle>{t('shippingOptions')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newShippingOption.name">{t('shippingOptionName')}</Label>
              <Input
                id="newShippingOption.name"
                name="name"
                value={newShippingOption.name}
                onChange={(e) => handleShippingInputChange(e)}
                placeholder={t('shippingOptionNamePlaceholder')}
                className={locale === 'ar' ? 'text-right' : 'text-left'}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newShippingOption.provider">{t('shippingProvider')}</Label>
              <Select
                value={newShippingOption.provider}
                onValueChange={(value) =>
                  setNewShippingOption((prev) => ({ ...prev, provider: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('selectShippingProvider')} />
                </SelectTrigger>
                <SelectContent>
                  {availableShippingProviders.map((provider) => (
                    <SelectItem key={provider} value={provider}>
                      {provider}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="newShippingOption.cost">{t('shippingCost')}</Label>
              <Input
                id="newShippingOption.cost"
                name="cost"
                type="number"
                value={newShippingOption.cost}
                onChange={(e) => handleShippingInputChange(e)}
                placeholder={t('shippingCostPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newShippingOption.estimatedDeliveryDays">{t('estimatedDeliveryDays')}</Label>
              <Input
                id="newShippingOption.estimatedDeliveryDays"
                name="estimatedDeliveryDays"
                type="number"
                value={newShippingOption.estimatedDeliveryDays}
                onChange={(e) => handleShippingInputChange(e)}
                placeholder={t('estimatedDeliveryDaysPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newShippingOption.regions">{t('regions')}</Label>
              <Input
                id="newShippingOption.regions"
                name="regions"
                value={newShippingOption.regions.join(',')}
                onChange={(e) =>
                  setNewShippingOption((prev) => ({
                    ...prev,
                    regions: e.target.value.split(',').map((r) => r.trim()),
                  }))
                }
                placeholder={t('regionsPlaceholder')}
                className={locale === 'ar' ? 'text-right' : 'text-left'}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>{t('shippingOptionActive')}</Label>
              <Switch
                id="newShippingOption.isActive"
                checked={newShippingOption.isActive}
                onCheckedChange={(checked) =>
                  setNewShippingOption((prev) => ({ ...prev, isActive: checked }))
                }
              />
            </div>
            <Button type="button" onClick={handleAddShippingOption}>
              {t('addShippingOption')}
            </Button>
            {formData.shippingOptions.length > 0 && (
              <div>
                <Label>{t('currentShippingOptions')}</Label>
                <ul className="list-disc pl-5">
                  {formData.shippingOptions.map((option, index) => (
                    <li key={index} className="flex justify-between items-center">
                      {option.name} ({option.provider}, {option.cost} {t('currency')}, {option.estimatedDeliveryDays} {t('days')})
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            shippingOptions: prev.shippingOptions.filter((_, i) => i !== index),
                          }))
                        }
                      >
                        {t('remove')}
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Discount Offers */}
        <Card>
          <CardHeader>
            <CardTitle>{t('discountOffers')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newDiscountOffer.code">{t('discountCode')}</Label>
              <Input
                id="newDiscountOffer.code"
                name="code"
                value={newDiscountOffer.code}
                onChange={(e) => handleDiscountInputChange(e)}
                placeholder={t('discountCodePlaceholder')}
                className={locale === 'ar' ? 'text-right' : 'text-left'}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newDiscountOffer.discountType">{t('discountType')}</Label>
              <Select
                value={newDiscountOffer.discountType}
                onValueChange={(value) =>
                  setNewDiscountOffer((prev) => ({ ...prev, discountType: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('selectDiscountType')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">{t('percentage')}</SelectItem>
                  <SelectItem value="fixed">{t('fixed')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="newDiscountOffer.discountValue">{t('discountValue')}</Label>
              <Input
                id="newDiscountOffer.discountValue"
                name="discountValue"
                type="number"
                value={newDiscountOffer.discountValue}
                onChange={(e) => handleDiscountInputChange(e)}
                placeholder={t('discountValuePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newDiscountOffer.minOrderValue">{t('minOrderValue')}</Label>
              <Input
                id="newDiscountOffer.minOrderValue"
                name="minOrderValue"
                type="number"
                value={newDiscountOffer.minOrderValue}
                onChange={(e) => handleDiscountInputChange(e)}
                placeholder={t('minOrderValuePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newDiscountOffer.startDate">{t('startDate')}</Label>
              <Input
                id="newDiscountOffer.startDate"
                name="startDate"
                type="date"
                value={newDiscountOffer.startDate.split('T')[0]}
                onChange={(e) => handleDiscountInputChange(e)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newDiscountOffer.endDate">{t('endDate')}</Label>
              <Input
                id="newDiscountOffer.endDate"
                name="endDate"
                type="date"
                value={newDiscountOffer.endDate.split('T')[0] || ''}
                onChange={(e) => handleDiscountInputChange(e)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>{t('discountOfferActive')}</Label>
              <Switch
                id="newDiscountOffer.isActive"
                checked={newDiscountOffer.isActive}
                onCheckedChange={(checked) =>
                  setNewDiscountOffer((prev) => ({ ...prev, isActive: checked }))
                }
              />
            </div>
            <Button type="button" onClick={handleAddDiscountOffer}>
              {t('addDiscountOffer')}
            </Button>
            {formData.discountOffers.length > 0 && (
              <div>
                <Label>{t('currentDiscountOffers')}</Label>
                <ul className="list-disc pl-5">
                  {formData.discountOffers.map((offer, index) => (
                    <li key={index} className="flex justify-between items-center">
                      {offer.code} ({offer.discountValue} {offer.discountType === 'percentage' ? '%' : t('currency')})
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            discountOffers: prev.discountOffers.filter((_, i) => i !== index),
                          }))
                        }
                      >
                        {t('remove')}
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Gateways */}
        {seller?.subscription?.features?.dynamicPaymentGateways && (
          <Card>
            <CardHeader>
              <CardTitle>{t('paymentGateways')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>{t('availableGateways')}</Label>
                <Select value={selectedGateway} onValueChange={setSelectedGateway}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectGateway')} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableGateways.map((gateway) => (
                      <SelectItem key={gateway._id} value={gateway.providerName}>
                        {gateway.providerName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                onClick={handleAddPaymentGateway}
                disabled={loading || !selectedGateway}
              >
                {t('addGateway')}
              </Button>
              {paymentGateways.length > 0 && (
                <div>
                  <Label>{t('connectedGateways')}</Label>
                  <ul className="list-disc pl-5">
                    {paymentGateways.map((gateway, index) => (
                      <li key={index} className="flex justify-between items-center">
                        {gateway.providerName} ({gateway.isDefault ? t('default') : ''})
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              paymentGateways: prev.paymentGateways.filter((_, i) => i !== index),
                            }))
                          }
                        >
                          {t('remove')}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle>{t('notifications')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>{t('emailNotifications')}</Label>
              <Switch
                id="notifications.email"
                checked={formData.notifications.email}
                onCheckedChange={(checked) => handleSwitchChange('notifications.email', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>{t('smsNotifications')}</Label>
              <Switch
                id="notifications.sms"
                checked={formData.notifications.sms}
                onCheckedChange={(checked) => handleSwitchChange('notifications.sms', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>{t('orderUpdates')}</Label>
              <Switch
                id="notifications.orderUpdates"
                checked={formData.notifications.orderUpdates}
                onCheckedChange={(checked) => handleSwitchChange('notifications.orderUpdates', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>{t('marketingEmails')}</Label>
              <Switch
                id="notifications.marketingEmails"
                checked={formData.notifications.marketingEmails}
                onCheckedChange={(checked) => handleSwitchChange('notifications.marketingEmails', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>{t('pointsNotifications')}</Label>
              <Switch
                id="notifications.pointsNotifications"
                checked={formData.notifications.pointsNotifications}
                onCheckedChange={(checked) => handleSwitchChange('notifications.pointsNotifications', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Display Settings */}
        <Card>
          <CardHeader>
            <CardTitle>{t('display')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>{t('showRating')}</Label>
              <Switch
                id="display.showRating"
                checked={formData.display.showRating}
                onCheckedChange={(checked) => handleSwitchChange('display.showRating', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>{t('showContactInfo')}</Label>
              <Switch
                id="display.showContactInfo"
                checked={formData.display.showContactInfo}
                onCheckedChange={(checked) => handleSwitchChange('display.showContactInfo', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>{t('showMetrics')}</Label>
              <Switch
                id="display.showMetrics"
                checked={formData.display.showMetrics}
                onCheckedChange={(checked) => handleSwitchChange('display.showMetrics', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>{t('showPointsBalance')}</Label>
              <Switch
                id="display.showPointsBalance"
                checked={formData.display.showPointsBalance}
                onCheckedChange={(checked) => handleSwitchChange('display.showPointsBalance', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card>
          <CardHeader>
            <CardTitle>{t('security')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>{t('twoFactorAuth')}</Label>
              <Switch
                id="security.twoFactorAuth"
                checked={formData.security.twoFactorAuth}
                onCheckedChange={(checked) => handleSwitchChange('security.twoFactorAuth', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>{t('loginNotifications')}</Label>
              <Switch
                id="security.loginNotifications"
                checked={formData.security.loginNotifications}
                onCheckedChange={(checked) => handleSwitchChange('security.loginNotifications', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Custom Site Settings */}
        <Card>
          <CardHeader>
            <CardTitle>{t('customSite')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="customSite.theme">{t('theme')}</Label>
              <Select
                value={formData.customSite.theme}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    customSite: { ...prev.customSite, theme: value },
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('selectTheme')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">{t('default')}</SelectItem>
                  <SelectItem value="dark">{t('dark')}</SelectItem>
                  <SelectItem value="light">{t('light')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="customSite.primaryColor">{t('primaryColor')}</Label>
              <Input
                id="customSite.primaryColor"
                name="customSite.primaryColor"
                type="color"
                value={formData.customSite.primaryColor}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <Label htmlFor="customSite.bannerImage">{t('bannerImage')}</Label>
              <Input
                id="customSite.bannerImage"
                type="file"
                accept="image/*"
                onChange={(e) => setBannerFile(e.target.files ? e.target.files[0] : null)}
              />
            </div>
          </CardContent>
        </Card>

        <Button type="submit" disabled={loading}>
          {t('save')}
        </Button>
      </form>
    </div>
  );
}