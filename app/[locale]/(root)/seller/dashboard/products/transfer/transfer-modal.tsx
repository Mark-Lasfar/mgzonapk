//home/hager/new/my-nextjs-project-master (3)/my-nextjs-project-master/app/[locale]/(root)/seller/dashboard/products/transfer/transfer-modal.tsx
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from 'next-intl';
// import { DatePicker } from '@/components/ui/date-picker';

export interface TransferModalProps {
  product: { id: string; name: string; warehouseData: Array<{ warehouseId: string; provider: string; location: string; quantity: number }> };
}

export default function TransferModal({ product }: TransferModalProps) {
  const t = useTranslations('Seller.Transfer');
  const [isOpen, setIsOpen] = useState(false);
  const [sourceWarehouseId, setSourceWarehouseId] = useState('');
  const [targetWarehouseId, setTargetWarehouseId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [scheduledAt, setScheduledAt] = useState<Date | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [maxQuantity, setMaxQuantity] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    if (sourceWarehouseId) {
      const sourceWarehouse = product.warehouseData.find(w => w.warehouseId === sourceWarehouseId);
      setMaxQuantity(sourceWarehouse?.quantity || 0);
    }
  }, [sourceWarehouseId, product.warehouseData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (parseInt(quantity) > maxQuantity) {
      toast({
        title: t('error'),
        description: t('quantityExceedsStock'),
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/warehouse/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          sourceWarehouseId,
          targetWarehouseId,
          quantity: parseInt(quantity),
          scheduledAt: scheduledAt?.toISOString(),
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || t('transferFailed'));

      toast({
        title: t('success'),
        description: scheduledAt ? t('transferScheduled') : t('transferSubmitted'),
      });
      setIsOpen(false);
      setQuantity('');
      setSourceWarehouseId('');
      setTargetWarehouseId('');
      setScheduledAt(undefined);
    } catch (error) {
      toast({
        title: t('error'),
        description: error instanceof Error ? error.message : t('transferFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const calculateFee = () => {
    if (!sourceWarehouseId || !targetWarehouseId) return t('free');
    const sourceProvider = product.warehouseData.find(w => w.warehouseId === sourceWarehouseId)?.provider;
    const targetProvider = product.warehouseData.find(w => w.warehouseId === targetWarehouseId)?.provider;
    return sourceProvider !== targetProvider ? '$0.50/unit' : t('free');
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>{t('transferProduct')}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('transferTitle', { productName: product.name })}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium">{t('sourceWarehouse')}</label>
            <Select onValueChange={setSourceWarehouseId} value={sourceWarehouseId}>
              <SelectTrigger>
                <SelectValue placeholder={t('selectSourceWarehouse')} />
              </SelectTrigger>
              <SelectContent>
                {product.warehouseData.map((w) => (
                  <SelectItem key={w.warehouseId} value={w.warehouseId}>
                    {w.provider} - {w.location} (Qty: {w.quantity})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium">{t('targetWarehouse')}</label>
            <Select onValueChange={setTargetWarehouseId} value={targetWarehouseId}>
              <SelectTrigger>
                <SelectValue placeholder={t('selectTargetWarehouse')} />
              </SelectTrigger>
              <SelectContent>
                {product.warehouseData
                  .filter((w) => w.warehouseId !== sourceWarehouseId)
                  .map((w) => (
                    <SelectItem key={w.warehouseId} value={w.warehouseId}>
                      {w.provider} - {w.location} (Qty: {w.quantity})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium">{t('quantity')}</label>
            <Input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              min="1"
              max={maxQuantity}
              placeholder={t('enterQuantity')}
              required
            />
            {maxQuantity > 0 && (
              <p className="text-sm text-muted-foreground">{t('availableQuantity', { quantity: maxQuantity })}</p>
            )}
          </div>
        npm install react-datepicker @types/react-datepicker
          {sourceWarehouseId && targetWarehouseId && (
            <p className="text-sm text-muted-foreground">
              {t('fee')}: {calculateFee()}
            </p>
          )}
          <Button type="submit" disabled={isLoading || !sourceWarehouseId || !targetWarehouseId || !quantity}>
            {isLoading ? t('processing') : t('confirmTransfer')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
