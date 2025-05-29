'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';

interface Warehouse {
  id: string;
  name: string;
  location: string;
  costPerUnit: number;
  supportedProducts: string[];
}

async function fetchWarehouses(provider: 'ShipBob' | '4PX', token: string): Promise<Warehouse[]> {
  const response = await fetch(`/api/warehouses?provider=${provider}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error('Failed to fetch warehouses');
  }
  const result = await response.json();
  return result.data;
}

export default function WarehouseSelection() {
  const { data: session } = useSession();
  const t = useTranslations('warehouse');
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('');
  const [provider, setProvider] = useState<'ShipBob' | '4PX'>('ShipBob');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadWarehouses() {
      if (!session?.user?.id) return;
      setLoading(true);
      try {
        const data = await fetchWarehouses(provider, session.accessToken || '');
        setWarehouses(data);
      } catch (error) {
        toast({
          title: t('error'),
          description: t('fetchFailed'),
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    }
    loadWarehouses();
  }, [provider, session]);

  const handleSubmit = async () => {
    if (!session?.user?.id) {
      toast({
        title: t('error'),
        description: t('loginRequired'),
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/seller/registration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.accessToken || ''}`,
        },
        body: JSON.stringify({
          businessName: 'My Business',
          email: session.user.email,
          phone: '1234567890',
          address: { country: 'US', city: 'New York', state: 'NY', street: '123 Main St', postalCode: '10001' },
          businessType: 'company',
          vatRegistered: false,
          taxId: '123456789',
          bankInfo: {
            accountName: 'My Business',
            accountNumber: '123456789',
            bankName: 'Example Bank',
            swiftCode: 'EXMPUS33',
          },
          termsAccepted: true,
          preferredWarehouse: { provider, warehouseId: selectedWarehouse, selectedAt: new Date() },
        }),
      });
      const result = await response.json();
      if (result.success) {
        toast({
          title: t('success'),
          description: t('saved'),
        });
      } else {
        toast({
          title: t('error'),
          description: result.message || t('saveFailed'),
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: t('error'),
        description: t('saveFailed'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4">
      <img src="/icons/logo.svg" alt="Mgzon Logo" className="h-10 mb-4" />
      <h2 className="text-2xl font-bold mb-4">{t('title')}</h2>
      <Select onValueChange={setProvider} defaultValue="ShipBob">
        <SelectTrigger>
          <SelectValue placeholder={t('selectProvider')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ShipBob">ShipBob</SelectItem>
          <SelectItem value="4PX">4PX</SelectItem>
        </SelectContent>
      </Select>
      <Select onValueChange={setSelectedWarehouse} disabled={loading || warehouses.length === 0}>
        <SelectTrigger className="mt-4">
          <SelectValue placeholder={t('selectWarehouse')} />
        </SelectTrigger>
        <SelectContent>
          {warehouses.map(warehouse => (
            <SelectItem key={warehouse.id} value={warehouse.id}>
              {warehouse.name} ({warehouse.location}, ${warehouse.costPerUnit}/unit)
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button onClick={handleSubmit} disabled={loading || !selectedWarehouse} className="mt-4">
        {loading ? t('saving') : t('save')}
      </Button>
    </div>
  );
}