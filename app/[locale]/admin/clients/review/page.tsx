'use client';

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { Star } from 'lucide-react';

interface Client {
  _id: string;
  name: string;
  clientId: string;
  clientSecret: string;
  redirectUris: string[];
  scopes: string[];
  description?: string;
  logoUrl?: string;
  videos?: Array<{ url: string; position: 'left' | 'center' | 'right'; size: 'small' | 'medium' | 'large' }>;
  images?: Array<{ url: string; position: 'left' | 'center' | 'right'; size: 'small' | 'medium' | 'large' }>;
  buttons?: Array<{ label: string; link: string; type: 'primary' | 'secondary' | 'link' }>;
  features?: string[];
  categories?: string[];
  rating?: number;
  ratingsCount?: number;
  installs?: number;
  status: 'pending' | 'approved' | 'rejected';
  commissionRate?: number;
  createdAt: string;
  slug: string;
}

export default function ClientReviewPage() {
  const t = useTranslations('admin.clients.review');
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [commissionRates, setCommissionRates] = useState<{ [key: string]: number }>({});

  const fetchClients = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/clients');
      if (!response.ok) throw new Error(t('fetch_error'));
      const { data } = await response.json();
      setClients(data.clients || []);
    } catch (error) {
      toast({ variant: 'destructive', title: t('error_title'), description: String(error) });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReview = async (clientId: string, status: 'approved' | 'rejected') => {
    try {
      const commissionRate = commissionRates[clientId];
      if (status === 'approved' && (commissionRate === undefined || commissionRate < 0 || commissionRate > 1)) {
        toast({ variant: 'destructive', title: t('error_title'), description: t('invalid_commission') });
        return;
      }

      const response = await fetch(`/api/admin/clients/${clientId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, commissionRate }),
      });

      if (!response.ok) throw new Error(t('review_error'));
      await fetchClients();
      toast({ title: t('success_title'), description: t('review_success') });
    } catch (error) {
      toast({ variant: 'destructive', title: t('error_title'), description: String(error) });
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">{t('title')}</h1>
      {isLoading ? (
        <p>{t('loading')}</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => (
            <Card key={client._id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {client.logoUrl && (
                    <Image src={client.logoUrl} alt={client.name} width={40} height={40} className="object-contain" />
                  )}
                  {client.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4">{client.description || t('no_description')}</p>
                <p className="mb-4">{t('status')}: {t(client.status)}</p>
                <p className="mb-4">{t('slug')}: <a href={`/integrations/${client.slug}`} className="text-blue-600 hover:underline">{client.slug}</a></p>
                {client.features && client.features.length > 0 && (
                  <div className="mb-4">
                    <span className="font-medium text-gray-700 dark:text-gray-300">{t('features')}:</span>
                    <ul className="list-disc pl-5">
                      {client.features.map((feature, index) => (
                        <li key={index} className="text-sm text-gray-600">{feature}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {client.categories && client.categories.length > 0 && (
                  <div className="mb-4">
                    <span className="font-medium text-gray-700 dark:text-gray-300">{t('categories')}:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {client.categories.map((category, index) => (
                        <span
                          key={index}
                          className="inline-block bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-full text-xs"
                        >
                          {t(category)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {client.rating && (
                  <div className="mb-4 flex items-center">
                    <span className="font-medium text-gray-700 dark:text-gray-300">{t('rating')}:</span>
                    <div className="flex ml-2">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${i < Math.round(client.rating!) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
                        />
                      ))}
                      <span className="ml-2 text-sm text-gray-600">({client.ratingsCount} {t('reviews')})</span>
                    </div>
                  </div>
                )}
                {client.installs && (
                  <div className="mb-4">
                    <span className="font-medium text-gray-700 dark:text-gray-300">{t('installs')}:</span>
                    <span className="ml-2 text-sm text-gray-600">{client.installs}</span>
                  </div>
                )}
                {client.images?.[0] && (
                  <Image
                    src={client.images[0].url}
                    alt={client.name}
                    width={client.images[0].size === 'large' ? 300 : client.images[0].size === 'medium' ? 200 : 100}
                    height={client.images[0].size === 'large' ? 300 : client.images[0].size === 'medium' ? 200 : 100}
                    className={`mb-4 ${client.images[0].position === 'center' ? 'mx-auto' : client.images[0].position === 'left' ? 'mr-auto' : 'ml-auto'}`}
                  />
                )}
                {client.videos?.[0] && (
                  <video
                    src={client.videos[0].url}
                    controls
                    className={`mb-4 ${client.videos[0].size === 'large' ? 'w-full' : client.videos[0].size === 'medium' ? 'w-3/4' : 'w-1/2'} ${
                      client.videos[0].position === 'center' ? 'mx-auto' : client.videos[0].position === 'left' ? 'mr-auto' : 'ml-auto'
                    }`}
                  />
                )}
                {client.buttons?.map((button) => (
                  <Button
                    key={button.label}
                    variant={button.type === 'primary' ? 'default' : button.type === 'secondary' ? 'outline' : 'link'}
                    className="mr-2 mb-2"
                    onClick={() => window.open(button.link, '_blank')}
                  >
                    {button.label}
                  </Button>
                ))}
                {client.status === 'pending' && (
                  <div className="mt-4">
                    <Label htmlFor={`commissionRate-${client._id}`}>{t('commission_rate')}</Label>
                    <Input
                      id={`commissionRate-${client._id}`}
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      placeholder="0.05"
                      onChange={(e) => setCommissionRates({ ...commissionRates, [client._id]: Number(e.target.value) })}
                      className="mb-2"
                    />
                    <div className="flex gap-2">
                      <Button onClick={() => handleReview(client._id, 'approved')}>
                        {t('approve')}
                      </Button>
                      <Button variant="destructive" onClick={() => handleReview(client._id, 'rejected')}>
                        {t('reject')}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}