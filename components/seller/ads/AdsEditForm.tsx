'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useForm, FormProvider, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation } from '@apollo/client/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { PlusCircle, Trash2, ArrowLeft } from 'lucide-react';
import Sidebar from '@/components/ui/Sidebar';
import { CreativeInput } from './CreativeInput';
import { GET_INTEGRATIONS } from '@/graphql/seller/queries';
import { UPDATE_CAMPAIGN } from '@/graphql/ads/mutations'; // Import from mutations.ts
import { GET_CAMPAIGN } from '@/graphql/ads/queries'; // Import from queries.ts

import { useToast } from '@/hooks/use-toast';

const campaignSchema = z.object({
  integrationId: z.string().min(1, 'Ads.Error.Integration Required'),
  name: z.string().min(1, 'Ads.Error.Name Required'),
  budget: z.object({
    amount: z.number().positive('Ads.Error.Budget Positive'),
    currency: z.string().min(1, 'Ads.Error.Currency Required'),
  }),
  schedule: z.object({
    startDate: z.string().refine(
      (val) => {
        const date = new Date(val);
        return !isNaN(Date.parse(val)) && date >= new Date();
      },
      'Ads.Error.Invalid Start Date'
    ),
    endDate: z.string().optional(),
  }),
  targeting: z.record(z.string(), z.any()).optional(), // Specify key type as string
  creatives: z
    .array(
      z.object({
        type: z.enum(['image', 'video', 'text']),
        url: z.string().url('Ads.Error.Invalid Url'),
        metadata: z.record(z.string(), z.any()).optional(), // Specify key type as string
      })
    )
    .min(1, 'Ads.Error.Creatives Required'),
});

type CampaignForm = z.infer<typeof campaignSchema>;

interface AdCampaign {
  _id: string;
  providerName: string;
  name: string;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'failed';
  budget: { amount: number; currency: string };
  schedule: { startDate: string; endDate?: string };
  metrics: { impressions: number; clicks: number; conversions: number; spend: number };
  targeting?: Record<string, any>;
  creatives: { type: 'image' | 'video' | 'text'; url: string; metadata?: Record<string, any> }[];
  integrationId: string;
}

interface Integration {
  id: string;
  providerName: string;
}

interface CampaignQuery {
  campaign: AdCampaign;
}

interface IntegrationsQuery {
  integrations: Integration[];
}

export default function AdsEditForm({ campaignId }: { campaignId: string }) {
  const t = useTranslations('Ads');
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CampaignForm>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      integrationId: '',
      name: '',
      budget: { amount: 0, currency: 'USD' },
      schedule: { startDate: new Date().toISOString() },
      creatives: [{ type: 'image', url: '' }],
    },
  });

  const { fields: creatives, append, remove } = useFieldArray({
    control: form.control,
    name: 'creatives',
  });

  const { data: campaignData, loading: campaignLoading } = useQuery<CampaignQuery>(GET_CAMPAIGN, {
    variables: { campaignId },
  });
  const { data: integrationsData, loading: integrationsLoading } = useQuery<IntegrationsQuery>(GET_INTEGRATIONS, {
    variables: { sellerId: 'SELLER_ID', sandboxMode: false }, // Replace SELLER_ID with actual sellerId
  });
  const [updateCampaign] = useMutation(UPDATE_CAMPAIGN);

  useEffect(() => {
    if (campaignData?.campaign) {
      form.reset({
        integrationId: campaignData.campaign.integrationId,
        name: campaignData.campaign.name,
        budget: campaignData.campaign.budget,
        schedule: {
          startDate: new Date(campaignData.campaign.schedule.startDate).toISOString().slice(0, 16),
          endDate: campaignData.campaign.schedule.endDate
            ? new Date(campaignData.campaign.schedule.endDate).toISOString().slice(0, 16)
            : undefined,
        },
        targeting: campaignData.campaign.targeting,
        creatives: campaignData.campaign.creatives.length
          ? campaignData.campaign.creatives
          : [{ type: 'image', url: '' }],
      });
    }
  }, [campaignData, form]);

  const onSubmit = async (data: CampaignForm) => {
    setIsSubmitting(true);
    try {
      const { data: updatedCampaign } = await updateCampaign({
        variables: { id: campaignId, input: data },
      });
      toast({ title: t('Success.Title'), description: t('Success.Updated') });
      router.push(`/seller/dashboard/ads/${campaignId}`);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: t('Error.Title'),
        description: error.message || t('Error.Message'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (campaignLoading || integrationsLoading) {
    return (
      <div className="flex">
        <Sidebar notifications={[]} /> {/* Pass empty array if no notifications */}
        <div className="flex-1 container mx-auto p-6">
          <p>{t('Loading')}</p>
        </div>
      </div>
    );
  }

  if (!campaignData?.campaign) {
    return (
      <div className="flex">
        <Sidebar notifications={[]} /> {/* Pass empty array if no notifications */}
        <div className="flex-1 container mx-auto p-6">
          <p>{t('Error.Campaign Not Found')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex">
      <Sidebar notifications={[]} /> {/* Pass empty array or fetch notifications */}
      <div className="flex-1 container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">{t('Edit Campaign')}</h1>
          <Button onClick={() => router.push(`/seller/dashboard/ads/${campaignId}`)}>
            <ArrowLeft className="h-4 w-4 mr-2" /> {t('Back to Details')}
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{campaignData.campaign.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <FormProvider {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="integrationId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Integration')}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('Select Integration')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {integrationsData?.integrations.map((int) => (
                            <SelectItem key={int.id} value={int.id}>
                              {int.providerName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Name')}</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder={t('Name Placeholder')} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="budget.amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Budget')}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          placeholder={t('Budget Placeholder')}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="budget.currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Currency')}</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder={t('Currency Placeholder')} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="schedule.startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Start Date')}</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="schedule.endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('End Date')}</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div>
                  <FormLabel>{t('Creatives')}</FormLabel>
                  {creatives.map((creative, index) => (
                    <CreativeInput
                      key={creative.id}
                      index={index}
                      removeCreative={remove}
                      control={form.control}
                      t={t}
                    />
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => append({ type: 'image', url: '' })}
                    disabled={isSubmitting}
                  >
                    <PlusCircle className="h-4 w-4 mr-2" /> {t('Add Creative')}
                  </Button>
                </div>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? t('Loading') : t('Update')}
                </Button>
              </form>
            </FormProvider>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}