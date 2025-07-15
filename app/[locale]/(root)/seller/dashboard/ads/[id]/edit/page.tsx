'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useForm, FormProvider, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Trash2, ArrowLeft } from 'lucide-react';
import Sidebar from '@/components/ui/Sidebar';
// import Sidebar from '@/components/Sidebar';

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
  _id: string;
  providerName: string;
  connected: boolean;
}

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
  targeting: z.record(z.any()).optional(),
  creatives: z.array(
    z.object({
      type: z.enum(['image', 'video', 'text']),
      url: z.string().url('Ads.Error.Invalid Url'),
      metadata: z.record(z.any()).optional(),
    })
  ).min(1, 'Ads.Error.Creatives Required'),
});

type CampaignForm = z.infer<typeof campaignSchema>;

const CreativeInput = ({ index, removeCreative, control, t }: { index: number; removeCreative: (index: number) => void; control: any; t: any }) => {
  return (
    <div className="flex space-x-2 mb-3 items-center">
      <FormField
        control={control}
        name={`creatives.${index}.type`}
        render={({ field }) => (
          <FormItem>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="image">{t('Image')}</SelectItem>
                <SelectItem value="video">{t('Video')}</SelectItem>
                <SelectItem value="text">{t('Text')}</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name={`creatives.${index}.url`}
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <Input placeholder={t('Creative Url Placeholder')} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <Button type="button" variant="destructive" onClick={() => removeCreative(index)}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default function CampaignEditPage({ params }: { params: { id: string } }) {
  const t = useTranslations('Ads');
  const router = useRouter();
  const { toast } = useToast();
  const [campaign, setCampaign] = useState<AdCampaign | null>(null);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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

  useEffect(() => {
    const abortController = new AbortController();
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [campaignRes, integrationsRes] = await Promise.all([
          fetch(`/api/seller/ads?campaignId=${params.id}`, { signal: abortController.signal }),
          fetch(`/api/seller/integrations`, { signal: abortController.signal }),
        ]);
        if (!campaignRes.ok || !integrationsRes.ok) {
          const errorData = await (campaignRes.ok ? integrationsRes : campaignRes).json();
          throw new Error(errorData.message || t('Error.Message'));
        }
        const { data: campaignData } = await campaignRes.json();
        const { data: integrationsData } = await integrationsRes.json();
        setCampaign(campaignData);
        setIntegrations(
          Array.isArray(integrationsData)
            ? integrationsData.filter((int: Integration) => int.connected && int.providerName.includes('ads'))
            : []
        );
        form.reset({
          integrationId: campaignData.integrationId,
          name: campaignData.name,
          budget: campaignData.budget,
          schedule: {
            startDate: new Date(campaignData.schedule.startDate).toISOString().slice(0, 16),
            endDate: campaignData.schedule.endDate
              ? new Date(campaignData.schedule.endDate).toISOString().slice(0, 16)
              : undefined,
          },
          targeting: campaignData.targeting,
          creatives: campaignData.creatives,
        });
      } catch (error: any) {
        if (error.name === 'AbortError') return;
        toast({ variant: 'destructive', title: t('Error.Title'), description: error.message || t('Error.Message') });
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
    return () => abortController.abort();
  }, [params.id, t, form]);

  const onSubmit = async (data: CampaignForm) => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/seller/ads?campaignId=${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || t('Error.Message'));
      }
      const { data: updatedCampaign } = await response.json();
      setCampaign(updatedCampaign);
      toast({ title: t('Success.Title'), description: t('Success.Updated') });
      router.push(`/seller/dashboard/ads/${params.id}`);
    } catch (error: any) {
      toast({ variant: 'destructive', title: t('Error.Title'), description: error.message || t('Error.Message') });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex">
        <Sidebar />
        <div className="flex-1 container mx-auto p-6">
          <p>{t('Loading')}</p>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="flex">
        <Sidebar />
        <div className="flex-1 container mx-auto p-6">
          <p>{t('Error.Campaign Not Found')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1 container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">{t('Edit Campaign')}</h1>
          <Button onClick={() => router.push(`/seller/dashboard/ads/${params.id}`)}>
            <ArrowLeft className="h-4 w-4 mr-2" /> {t('Back to Details')}
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{campaign.name}</CardTitle>
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
                          {integrations.map((int) => (
                            <SelectItem key={int._id} value={int._id}>
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
                    <CreativeInput key={creative.id} index={index} removeCreative={remove} control={form.control} t={t} />
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