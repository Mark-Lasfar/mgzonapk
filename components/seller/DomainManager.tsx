// /components/seller/DomainManager.tsx
'use client';

import { useState, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';

interface Domain {
  domainName: string;
  isPrimary: boolean;
  dnsStatus: 'pending' | 'verified' | 'failed';
}

interface Props {
  storeId: string;
}

export default function DomainManager({ storeId }: Props) {
  const t = useTranslations('DomainManager');
  const { toast } = useToast();
  const [customDomain, setCustomDomain] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [dnsInstructions, setDnsInstructions] = useState<string | null>(null);

  const fetchDomains = useCallback(async () => {
    try {
      const response = await fetch(`/api/stores/${storeId}/domains`);
      const result = await response.json();
      if (result.success) {
        setDomains(result.domains);
      } else {
        throw new Error(result.error || t('errors.fetchDomainsFailed'));
      }
    } catch (error) {
      toast({
        title: t('errors.fetchDomainsFailed'),
        description: error instanceof Error ? error.message : t('errors.fetchDomainsFailed'),
        variant: 'destructive',
      });
    }
  }, [storeId, t, toast]);

  useEffect(() => {
    fetchDomains();
  }, [fetchDomains]);

  const handleAddDomain = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/stores/${storeId}/domain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeName: 'store', plan: 'Pro', customDomain }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || t('errors.addDomainFailed'));
      }
      setDnsInstructions(result.dnsInstructions);
      await fetchDomains();
      toast({ title: t('success'), description: t('domainAdded') });
      setCustomDomain(''); // Clear input after successful addition
    } catch (error) {
      toast({
        title: t('errors.addDomainFailed'),
        description: error instanceof Error ? error.message : t('errors.addDomainFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [customDomain, storeId, t, toast, fetchDomains]);

  const setPrimaryDomain = async (domainName: string) => {
    try {
      const response = await fetch(`/api/stores/${storeId}/domain/primary`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domainName }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || t('errors.setPrimaryFailed'));
      }
      await fetchDomains();
      toast({ title: t('success'), description: t('primaryDomainSet') });
    } catch (error) {
      toast({
        title: t('errors.setPrimaryFailed'),
        description: error instanceof Error ? error.message : t('errors.setPrimaryFailed'),
        variant: 'destructive',
      });
    }
  };

  const getStatusIcon = (status: Domain['dnsStatus']) => {
    switch (status) {
      case 'verified':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('manageDomains')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            value={customDomain}
            onChange={(e) => setCustomDomain(e.target.value)}
            placeholder={t('enterCustomDomain')}
          />
          <Button onClick={handleAddDomain} disabled={isLoading || !customDomain}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t('addDomain')}
          </Button>
        </div>
        {dnsInstructions && (
          <div className="p-4 bg-gray-100 rounded-md">
            <p className="font-semibold">{t('dnsInstructions')}</p>
            <p>{dnsInstructions}</p>
          </div>
        )}
        <div className="space-y-2">
          {domains.length === 0 ? (
            <p className="text-gray-500">{t('noDomains')}</p>
          ) : (
            domains.map((domain) => (
              <div
                key={domain.domainName}
                className="flex items-center justify-between gap-2 p-2 border rounded"
              >
                <div className="flex items-center gap-2">
                  {getStatusIcon(domain.dnsStatus)}
                  <span>{domain.domainName}</span>
                  {domain.isPrimary && (
                    <span className="text-sm text-blue-600 font-semibold">
                      {t('primary')}
                    </span>
                  )}
                </div>
                {!domain.isPrimary && domain.dnsStatus === 'verified' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPrimaryDomain(domain.domainName)}
                  >
                    {t('setAsPrimary')}
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}