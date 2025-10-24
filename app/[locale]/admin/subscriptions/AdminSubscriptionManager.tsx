// /home/mark/Music/my-nextjs-project-clean/app/[locale]/admin/subscriptions/AdminSubscriptionManager.tsx
'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_SUBSCRIPTION_PLANS } from '@/graphql/subscription/admin-queries';
import { CREATE_SUBSCRIPTION_PLAN, UPDATE_SUBSCRIPTION_PLAN, DELETE_SUBSCRIPTION_PLAN } from '@/graphql/subscription/admin-mutations';
import { v4 as uuidv4 } from 'uuid';

interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  pointsCost: number;
  currency: string;
  description: string;
  features: {
    productsLimit: number;
    commission: number;
    prioritySupport: boolean;
    instantPayouts: boolean;
    customSectionsLimit: number;
    domainSupport: boolean;
    domainRenewal: boolean;
    pointsRedeemable: boolean;
    dynamicPaymentGateways: boolean;
    maxApiKeys: number;
    analyticsAccess: boolean;
    abTesting: boolean;
  };
  isTrial: boolean;
  trialDuration?: number;
  isActive: boolean;
}

export default function AdminSubscriptionManager() {
  const t = useTranslations('admin.subscriptions');
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [formData, setFormData] = useState<Partial<SubscriptionPlan>>({
    id: uuidv4(),
    name: '',
    price: 0,
    pointsCost: 0,
    currency: 'USD',
    description: '',
    features: {
      productsLimit: 0,
      commission: 0,
      prioritySupport: false,
      instantPayouts: false,
      customSectionsLimit: 0,
      domainSupport: false,
      domainRenewal: false,
      pointsRedeemable: false,
      dynamicPaymentGateways: false,
      maxApiKeys: 1,
      analyticsAccess: false,
      abTesting: false,
    },
    isTrial: false,
    trialDuration: 0,
    isActive: true,
  });
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);

  const { data, loading, error } = useQuery(GET_SUBSCRIPTION_PLANS);
  const [createPlan] = useMutation(CREATE_SUBSCRIPTION_PLAN);
  const [updatePlan] = useMutation(UPDATE_SUBSCRIPTION_PLAN);
  const [deletePlan] = useMutation(DELETE_SUBSCRIPTION_PLAN);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session?.user?.id || session.user.role !== 'Admin') {
      router.push('/sign-in');
      return;
    }
    setIsLoading(false);
  }, [router, session, status]);

  useEffect(() => {
    if (error) {
      toast({
        title: t('errors.fetchFailed'),
        description: error.message,
        variant: 'destructive',
      });
    }
  }, [error, t]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    if (name.startsWith('features.')) {
      const featureKey = name.split('.')[1] as keyof SubscriptionPlan['features'];
      setFormData((prev) => ({
        ...prev,
        features: {
          ...prev.features!,
          [featureKey]: type === 'number' ? Number(value) : value === 'true',
        },
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: type === 'number' ? Number(value) : value,
      }));
    }
  };

  const handleCheckboxChange = (name: string, checked: boolean | string) => {
    const isChecked = typeof checked === 'string' ? false : checked;
    if (name.startsWith('features.')) {
      const featureKey = name.split('.')[1] as keyof SubscriptionPlan['features'];
      setFormData((prev) => ({
        ...prev,
        features: {
          ...prev.features!,
          [featureKey]: isChecked,
        },
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: isChecked }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.id) {
      toast({
        title: t('errors.unauthorized'),
        variant: 'destructive',
      });
      return;
    }
    try {
      setIsLoading(true);
      const input = { ...formData, id: editingPlanId || formData.id };
      const mutation = editingPlanId ? updatePlan : createPlan;
      const { data } = await mutation({
        variables: { input },
      });
      if (data?.createSubscriptionPlan?.success || data?.updateSubscriptionPlan?.success) {
        toast({
          title: t('success.title'),
          description: editingPlanId ? t('success.updated') : t('success.created'),
        });
        resetForm();
      } else {
        toast({
          title: t('errors.saveFailed'),
          description: data?.createSubscriptionPlan?.message || data?.updateSubscriptionPlan?.message,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: t('errors.saveFailed'),
        description: error instanceof Error ? error.message : t('errors.server'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (plan: SubscriptionPlan) => {
    setFormData(plan);
    setEditingPlanId(plan.id);
  };

  const handleDelete = async (id: string) => {
    try {
      setIsLoading(true);
      const { data } = await deletePlan({ variables: { id } });
      if (data?.deleteSubscriptionPlan?.success) {
        toast({
          title: t('success.deleted'),
        });
      } else {
        toast({
          title: t('errors.deleteFailed'),
          description: data?.deleteSubscriptionPlan?.message,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: t('errors.deleteFailed'),
        description: error instanceof Error ? error.message : t('errors.server'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      id: uuidv4(),
      name: '',
      price: 0,
      pointsCost: 0,
      currency: 'USD',
      description: '',
      features: {
        productsLimit: 0,
        commission: 0,
        prioritySupport: false,
        instantPayouts: false,
        customSectionsLimit: 0,
        domainSupport: false,
        domainRenewal: false,
        pointsRedeemable: false,
        dynamicPaymentGateways: false,
        maxApiKeys: 1,
        analyticsAccess: false,
        abTesting: false,
      },
      isTrial: false,
      trialDuration: 0,
      isActive: true,
    });
    setEditingPlanId(null);
  };

  if (isLoading || status === 'loading') {
    return (
      <div className="flex justify-center p-6">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  const plans: SubscriptionPlan[] = data?.subscriptionPlans || [];

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">{t('title')}</h1>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{editingPlanId ? t('editPlan') : t('createPlan')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">{t('form.name')}</Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
              />
            </div>
            <div>
              <Label htmlFor="price">{t('form.price')}</Label>
              <Input
                id="price"
                name="price"
                type="number"
                value={formData.price}
                onChange={handleInputChange}
                required
              />
            </div>
            <div>
              <Label htmlFor="pointsCost">{t('form.pointsCost')}</Label>
              <Input
                id="pointsCost"
                name="pointsCost"
                type="number"
                value={formData.pointsCost}
                onChange={handleInputChange}
                required
              />
            </div>
            <div>
              <Label htmlFor="currency">{t('form.currency')}</Label>
              <Input
                id="currency"
                name="currency"
                value={formData.currency}
                onChange={handleInputChange}
                required
              />
            </div>
            <div>
              <Label htmlFor="description">{t('form.description')}</Label>
              <Input
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                required
              />
            </div>
            <div>
              <Label>{t('form.features')}</Label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="features.productsLimit">{t('form.features.productsLimit')}</Label>
                  <Input
                    id="features.productsLimit"
                    name="features.productsLimit"
                    type="number"
                    value={formData.features?.productsLimit}
                    onChange={handleInputChange}
                  />
                </div>
                <div>
                  <Label htmlFor="features.commission">{t('form.features.commission')}</Label>
                  <Input
                    id="features.commission"
                    name="features.commission"
                    type="number"
                    value={formData.features?.commission}
                    onChange={handleInputChange}
                  />
                </div>
                <div>
                  <Label htmlFor="features.customSectionsLimit">{t('form.features.customSectionsLimit')}</Label>
                  <Input
                    id="features.customSectionsLimit"
                    name="features.customSectionsLimit"
                    type="number"
                    value={formData.features?.customSectionsLimit}
                    onChange={handleInputChange}
                  />
                </div>
                <div>
                  <Label htmlFor="features.maxApiKeys">{t('form.features.maxApiKeys')}</Label>
                  <Input
                    id="features.maxApiKeys"
                    name="features.maxApiKeys"
                    type="number"
                    value={formData.features?.maxApiKeys}
                    onChange={handleInputChange}
                  />
                </div>
                <div>
                  <Label htmlFor="features.prioritySupport">{t('form.features.prioritySupport')}</Label>
                  <Checkbox
                    id="features.prioritySupport"
                    name="features.prioritySupport"
                    checked={formData.features?.prioritySupport}
                    onCheckedChange={(checked) => handleCheckboxChange('features.prioritySupport', checked)}
                  />
                </div>
                <div>
                  <Label htmlFor="features.instantPayouts">{t('form.features.instantPayouts')}</Label>
                  <Checkbox
                    id="features.instantPayouts"
                    name="features.instantPayouts"
                    checked={formData.features?.instantPayouts}
                    onCheckedChange={(checked) => handleCheckboxChange('features.instantPayouts', checked)}
                  />
                </div>
                <div>
                  <Label htmlFor="features.domainSupport">{t('form.features.domainSupport')}</Label>
                  <Checkbox
                    id="features.domainSupport"
                    name="features.domainSupport"
                    checked={formData.features?.domainSupport}
                    onCheckedChange={(checked) => handleCheckboxChange('features.domainSupport', checked)}
                  />
                </div>
                <div>
                  <Label htmlFor="features.domainRenewal">{t('form.features.domainRenewal')}</Label>
                  <Checkbox
                    id="features.domainRenewal"
                    name="features.domainRenewal"
                    checked={formData.features?.domainRenewal}
                    onCheckedChange={(checked) => handleCheckboxChange('features.domainRenewal', checked)}
                  />
                </div>
                <div>
                  <Label htmlFor="features.pointsRedeemable">{t('form.features.pointsRedeemable')}</Label>
                  <Checkbox
                    id="features.pointsRedeemable"
                    name="features.pointsRedeemable"
                    checked={formData.features?.pointsRedeemable}
                    onCheckedChange={(checked) => handleCheckboxChange('features.pointsRedeemable', checked)}
                  />
                </div>
                <div>
                  <Label htmlFor="features.dynamicPaymentGateways">{t('form.features.dynamicPaymentGateways')}</Label>
                  <Checkbox
                    id="features.dynamicPaymentGateways"
                    name="features.dynamicPaymentGateways"
                    checked={formData.features?.dynamicPaymentGateways}
                    onCheckedChange={(checked) => handleCheckboxChange('features.dynamicPaymentGateways', checked)}
                  />
                </div>
                <div>
                  <Label htmlFor="features.analyticsAccess">{t('form.features.analyticsAccess')}</Label>
                  <Checkbox
                    id="features.analyticsAccess"
                    name="features.analyticsAccess"
                    checked={formData.features?.analyticsAccess}
                    onCheckedChange={(checked) => handleCheckboxChange('features.analyticsAccess', checked)}
                  />
                </div>
                <div>
                  <Label htmlFor="features.abTesting">{t('form.features.abTesting')}</Label>
                  <Checkbox
                    id="features.abTesting"
                    name="features.abTesting"
                    checked={formData.features?.abTesting}
                    onCheckedChange={(checked) => handleCheckboxChange('features.abTesting', checked)}
                  />
                </div>
              </div>
            </div>
            <div>
              <Label htmlFor="isTrial">{t('form.isTrial')}</Label>
              <Checkbox
                id="isTrial"
                name="isTrial"
                checked={formData.isTrial}
                onCheckedChange={(checked) => handleCheckboxChange('isTrial', checked)}
              />
            </div>
            <div>
              <Label htmlFor="trialDuration">{t('form.trialDuration')}</Label>
              <Input
                id="trialDuration"
                name="trialDuration"
                type="number"
                value={formData.trialDuration}
                onChange={handleInputChange}
                disabled={!formData.isTrial}
              />
            </div>
            <div>
              <Label htmlFor="isActive">{t('form.isActive')}</Label>
              <Checkbox
                id="isActive"
                name="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => handleCheckboxChange('isActive', checked)}
              />
            </div>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? <Loader2 className="animate-spin" /> : editingPlanId ? t('form.update') : t('form.create')}
            </Button>
            {editingPlanId && (
              <Button type="button" variant="outline" onClick={resetForm} className="ml-2">
                {t('form.cancel')}
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('existingPlans')}</CardTitle>
        </CardHeader>
        <CardContent>
          {plans.length === 0 ? (
            <p>{t('noPlans')}</p>
          ) : (
            <ul className="space-y-4">
              {plans.map((plan) => (
                <li key={plan.id} className="flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold">{plan.name}</h3>
                    <p>{t('price')}: {plan.price} {plan.currency} / {plan.pointsCost} {t('points')}</p>
                    <p>{plan.description}</p>
                  </div>
                  <div>
                    <Button variant="outline" onClick={() => handleEdit(plan)} className="mr-2">
                      {t('edit')}
                    </Button>
                    <Button variant="destructive" onClick={() => handleDelete(plan.id)}>
                      {t('delete')}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}