'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { getSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';

interface Product {
  id: string;
  name: string;
  warehouseData: { warehouseId: string; quantity: number; location: string }[];
}

interface Warehouse {
  id: string;
  name: string;
  location: string;
  provider: string;
}

export default function ProductTransferPage() {
  const t = useTranslations('Seller.ProductTransfer');
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [sourceWarehouse, setSourceWarehouse] = useState('');
  const [targetWarehouse, setTargetWarehouse] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const session = await getSession();
        if (!session?.user?.id) {
          throw new Error('Authentication required');
        }

        const [productsRes, warehousesRes] = await Promise.all([
          fetch(`/api/seller/${session.user.id}/products`),
          fetch(`/api/seller/${session.user.id}/warehouses`),
        ]);

        if (!productsRes.ok || !warehousesRes.ok) {
          throw new Error('Failed to fetch data');
        }

        const productsData = await productsRes.json();
        const warehousesData = await warehousesRes.json();

        setProducts(productsData.data);
        setWarehouses(warehousesData.data);
      } catch (error) {
        toast({
          title: t('error'),
          description: t('fetchFailed'),
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [t, toast]);

  const handleTransfer = async () => {
    try {
      const session = await getSession();
      if (!session?.user?.id) {
        throw new Error('Authentication required');
      }

      const response = await fetch('/api/warehouse/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProduct,
          sourceWarehouseId: sourceWarehouse,
          targetWarehouseId: targetWarehouse,
          quantity,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to initiate transfer');
      }

      const { data } = await response.json();
      toast({
        title: t('success'),
        description: t('transferInitiated', { transferId: data._id }),
      });
      setIsModalOpen(false);
    } catch (error) {
      toast({
        title: t('error'),
        description: t('transferFailed'),
        variant: 'destructive',
      });
    }
  };

  const selectedProductData = products.find((p) => p.id === selectedProduct);
  const availableQuantity = selectedProductData?.warehouseData.find(
    (w) => w.warehouseId === sourceWarehouse
  )?.quantity || 0;

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">{t('title')}</h1>
      {isLoading ? (
        <p>{t('loading')}</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t('transferProduct')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                <SelectTrigger>
                  <SelectValue placeholder={t('selectProduct')} />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sourceWarehouse} onValueChange={setSourceWarehouse}>
                <SelectTrigger>
                  <SelectValue placeholder={t('selectSourceWarehouse')} />
                </SelectTrigger>
                <SelectContent>
                  {selectedProductData?.warehouseData.map((w) => (
                    <SelectItem key={w.warehouseId} value={w.warehouseId}>
                      {w.location} ({w.quantity} {t('units')})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={targetWarehouse} onValueChange={setTargetWarehouse}>
                <SelectTrigger>
                  <SelectValue placeholder={t('selectTargetWarehouse')} />
                </SelectTrigger>
                <SelectContent>
                  {warehouses
                    .filter((w) => w.id !== sourceWarehouse)
                    .map((warehouse) => (
                      <SelectItem key={warehouse.id} value={warehouse.id}>
                        {warehouse.name} ({warehouse.location})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>

              <Input
                type="number"
                min="1"
                max={availableQuantity}
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                placeholder={t('quantity')}
              />

              <Button
                onClick={() => setIsModalOpen(true)}
                disabled={!selectedProduct || !sourceWarehouse || !targetWarehouse || quantity <= 0}
              >
                {t('initiateTransfer')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('confirmTransfer')}</DialogTitle>
          </DialogHeader>
          <div>
            <p>{t('product')}: {selectedProductData?.name}</p>
            <p>{t('source')}: {selectedProductData?.warehouseData.find((w) => w.warehouseId === sourceWarehouse)?.location}</p>
            <p>{t('target')}: {warehouses.find((w) => w.id === targetWarehouse)?.name}</p>
            <p>{t('quantity')}: {quantity}</p>
            <p className="text-yellow-600">{t('transferWarning')}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleTransfer}>{t('confirm')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}