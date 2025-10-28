'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { CheckCircle, XCircle, RefreshCw, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { ClientApplication } from '@/lib/types';

interface ApiResponse {
  success: boolean;
  data?: { clients: ClientApplication[] };
  error?: string;
  requestId?: string;
  timestamp?: string;
}

export default function AdminClientsPage() {
  const t = useTranslations('AdminClients');
  const { toast } = useToast();
  const { data: session, status } = useSession();
  const [clients, setClients] = useState<ClientApplication[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchClients = async () => {
    if (!session?.user?.token || session?.user?.role !== 'ADMIN') {
      setError(t('errors.unauthorized'));
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/clients', {
        headers: {
          'Authorization': `Bearer ${session.user.token}`,
          'Accept-Language': session.user.locale || 'en',
        },
      });
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      const result: ApiResponse = await response.json();
      if (result.success) {
        setClients(result.data?.clients || []);
      } else {
        throw new Error(result.error || t('errors.fetchFailed'));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('errors.fetchFailed');
      setError(errorMessage);
      toast({
        title: t('errors.fetchFailed'),
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'authenticated') {
      fetchClients();
    }
  }, [status, session]);

  const reviewClient = async (clientId: string, status: 'approved' | 'rejected') => {
    if (!session?.user?.token) {
      setError(t('errors.unauthorized'));
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/admin/clients/${clientId}/review`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.user.token}`,
          'Accept-Language': session.user.locale || 'en',
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      const result = await response.json();
      if (!result.success) throw new Error(result.error || t('errors.reviewFailed'));

      setClients(clients.filter((client) => client.clientId !== clientId));
      toast({
        title: t('success.reviewed'),
        description: t(`success.${status}`),
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('errors.reviewFailed');
      setError(errorMessage);
      toast({
        title: t('errors.reviewFailed'),
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading') {
    return <div className="text-center py-8">{t('loading')}</div>;
  }

  if (session?.user?.role !== 'ADMIN') {
    return (
      <div className="max-w-4xl mx-auto mt-10 p-4">
        <h1 className="text-2xl font-bold mb-4">{t('title')}</h1>
        <div className="text-center py-8 text-red-600">{t('errors.unauthorized')}</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto mt-10 p-4">
      <h1 className="text-2xl font-bold mb-4">{t('title')}</h1>
      {error && (
        <div className="mb-4">
          <div className="bg-red-100 text-red-700 p-4 rounded">{error}</div>
        </div>
      )}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">{t('pendingClients')}</h2>
        <Button variant="outline" onClick={fetchClients} disabled={loading}>
          <RefreshCw className="h-4 w-4 mr-2" />
          {t('refresh')}
        </Button>
      </div>
      {loading ? (
        <div className="text-center py-8">{t('loading')}</div>
      ) : clients.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">{t('noClientsFound')}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clients.map((client) => (
            <Card key={client.id} className="hover:shadow-lg transition">
              <CardHeader>
                <div className="flex items-center gap-4">
                  {client.logoUrl && (
                    <Image
                      src={client.logoUrl}
                      alt={client.name}
                      width={80}
                      height={80}
                      className="object-contain rounded"
                    />
                  )}
                  <Dialog>
                    <DialogTrigger asChild>
                      <CardTitle className="cursor-pointer hover:underline">{client.name}</CardTitle>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[600px]">
                      <DialogHeader>
                        <DialogTitle>{client.name}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <p><strong>{t('description')}:</strong> {client.description || t('noDescription')}</p>
                        <p><strong>{t('clientId')}:</strong> {client.clientId}</p>
                        <p><strong>{t('redirectUris')}:</strong> {client.redirectUris.join(', ')}</p>
                        <p><strong>{t('scopes')}:</strong> {client.scopes.join(', ')}</p>
                        {client.customScopes?.length > 0 && (
                          <p><strong>{t('customScopes')}:</strong> {client.customScopes.join(', ')}</p>
                        )}
                        {client.features?.length > 0 && (
                          <p><strong>{t('features')}:</strong> {client.features.join(', ')}</p>
                        )}
                        {client.categories?.length > 0 && (
                          <p><strong>{t('categories')}:</strong> {client.categories.join(', ')}</p>
                        )}
                        <p><strong>{t('status')}:</strong> {t(`status.${client.status}`)}</p>
                        <p><strong>{t('created')}:</strong> {new Date(client.createdAt).toLocaleDateString()}</p>
                        <div className="flex gap-2">
                          <Button
                            variant="default"
                            onClick={() => reviewClient(client.clientId, 'approved')}
                            disabled={loading}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" /> {t('approve')}
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => reviewClient(client.clientId, 'rejected')}
                            disabled={loading}
                          >
                            <XCircle className="h-4 w-4 mr-1" /> {t('reject')}
                          </Button>
                          <Button variant="outline" asChild>
                            <Link href={`/integrations/${client.slug}`}>
                              <ExternalLink className="h-4 w-4 mr-1" /> {t('viewDetails')}
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-300 mb-2">
                  {client.description?.slice(0, 100) || t('noDescription')}
                  {client.description && client.description.length > 100 && '...'}
                </p>
                <Badge variant={client.status === 'approved' ? 'default' : 'secondary'}>
                  {t(`status.${client.status}`)}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}