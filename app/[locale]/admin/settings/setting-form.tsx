'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { SettingInputSchema } from '@/lib/validator';
import { ClientSetting, ISettingInput } from '@/types';
import { useToast } from '@/hooks/use-toast';
import LanguageForm from './language-form';
import CurrencyForm from './currency-form';
import PaymentMethodForm from './payment-method-form';
import DeliveryDateForm from './delivery-date-form';
import SiteInfoForm from './site-info-form';
import CommonForm from './common-form';
import CarouselForm from './carousel-form';
import PointsForm from './points-form';
import SubscriptionSettingsForm from './subscription-settings-form';
import AIAssistantForm from './ai-assistant-form';
import useSetting from '../../../../hooks/use-setting';
import { useQuery, useMutation } from '@apollo/client/react';
import { GET_SETTINGS, UPDATE_SETTINGS } from '@/graphql/settings/queries';

const SettingForm = ({ setting }: { setting: ISettingInput }) => {
  const { setSetting } = useSetting();
  const { toast } = useToast();
  
  const { data, loading, error } = useQuery(GET_SETTINGS);
  const [updateSettings] = useMutation(UPDATE_SETTINGS);

  const form = useForm<ISettingInput>({
    resolver: zodResolver(SettingInputSchema),
    defaultValues: {
      ...setting,
      ...data?.settings,
      points: data?.settings?.points || setting.points || {
        earnRate: 1,
        redeemValue: 0.05,
        registrationBonus: {
          buyer: 50,
          seller: 100,
        },
        sellerPointsPerSale: 10,
      },
      subscriptions: data?.settings?.subscriptions || setting.subscriptions || {
        points: {
          earnRate: 1,
          redeemValue: 0.05,
          registrationBonus: {
            buyer: 50,
            seller: 100,
          },
          sellerPointsPerSale: 10,
          enabled: true,
          rate: 1,
        },
      },
      aiAssistant: data?.settings?.aiAssistant || setting.aiAssistant || {
        price: 7.00,
        description: 'Unlock the full potential of the AI Assistant with a Premium subscription!',
        image: 'https://mgzonai.vercel.app/static/images/mg.svg',
        enabled: true,
        freeLimit: 10,
      },
    },
  });

  const {
    formState: { isSubmitting },
  } = form;

  async function onSubmit(values: ISettingInput) {
    try {
      const { data: mutationData } = await updateSettings({
        variables: { input: values },
        refetchQueries: [{ query: GET_SETTINGS }],
      });
      
      if (mutationData?.updateSettings?.success) {
        toast({
          description: mutationData.updateSettings.message,
        });
        setSetting(values as ClientSetting);
      } else {
        toast({
          variant: 'destructive',
          description: mutationData?.updateSettings?.message || 'Failed to update settings',
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        description: error instanceof Error ? error.message : 'Failed to update settings',
      });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p>Loading settings...</p>
        </div>
      </div>
    );
  }

  if (error) {
    toast({
      variant: 'destructive',
      description: `Error loading settings: ${error.message}`,
    });
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800">Error loading settings: {error.message}</p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        <SiteInfoForm id="setting-site-info" form={form} />
        <CommonForm id="setting-common" form={form} />
        <CarouselForm id="setting-carousels" form={form} />
        <LanguageForm id="setting-languages" form={form} />
        <CurrencyForm id="setting-currencies" form={form} />
        <PaymentMethodForm id="setting-payment-methods" form={form} />
        <DeliveryDateForm id="setting-delivery-dates" form={form} />
        <SubscriptionSettingsForm id="setting-subscriptions" form={form} />
        <PointsForm id="setting-points" form={form} points={form.getValues('points')} />
        <AIAssistantForm id="setting-ai-assistant" form={form} />
        <div className="pt-6 border-t">
          <Button 
            type="submit" 
            size="lg" 
            disabled={isSubmitting}
            className="w-full"
          >
            {isSubmitting ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default SettingForm;