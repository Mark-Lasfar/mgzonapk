// app/seller/components/ProductImport.tsx
'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { readCSVFile, parseCSV, validateCSV } from '@/lib/utils/csv';
import { parseXML, validateXML } from '@/lib/utils/xml';
import { getDynamicIntegrations } from '@/lib/services/integrations';
import { MarketplaceProduct } from '@/lib/types/marketplace';
import { v4 as uuidv4 } from 'uuid';

interface DropshippingProduct {
  id: string;
  title: string;
  price: number;
  currency: string;
  imageUrl: string;
  sourceId: string;
  sourcePlatform: string;
}

export default function ProductImport() {
  const t = useTranslations('seller.products.import');
  const { toast } = useToast();
  const { data: session } = useSession();
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [selectedIntegration, setSelectedIntegration] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dropshippingProducts, setDropshippingProducts] = useState<DropshippingProduct[]>([]);

  useEffect(() => {
    if (session?.user?.id) {
      fetchIntegrations();
    }
  }, [session]);

  const fetchIntegrations = async () => {
    try {
      const response = await getDynamicIntegrations(session!.user!.id, false);
      if (response.success) {
        setIntegrations(response.data.filter((int: any) => int.type === 'dropshipping' && int.status === 'connected'));
      } else {
        toast({
          variant: 'destructive',
          title: t('error'),
          description: t('failedToFetchIntegrations'),
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: t('unexpectedError'),
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const handleFileImport = async () => {
    if (!file) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: t('noFileSelected'),
      });
      return;
    }

    setIsLoading(true);
    try {
      const content = await readCSVFile(file);
      let products: Partial<MarketplaceProduct>[];

      if (file.name.endsWith('.csv')) {
        const validation = validateCSV(content, ['title', 'price', 'sku', 'quantity', 'category']);
        if (!validation.valid) {
          throw new Error(validation.errors.join('\n'));
        }
        products = parseCSV(content, { skipHeader: true }).map((row) => ({
          title: row.title,
          price: parseFloat(row.price),
          sku: row.sku,
          quantity: parseInt(row.quantity),
          categories: [row.category],
          images: row.images ? row.images.split(',') : [],
          status: 'draft',
          currency: row.currency || 'USD',
          region: row.region || 'global',
        }));
      } else if (file.name.endsWith('.xml')) {
        const validation = validateXML(content, ['title', 'price', 'sku', 'quantity', 'category']);
        if (!validation.valid) {
          throw new Error(validation.errors.join('\n'));
        }
        products = parseXML(content).map((row: any) => ({
          title: row.title,
          price: parseFloat(row.price),
          sku: row.sku,
          quantity: parseInt(row.quantity),
          categories: [row.category],
          images: row.images ? row.images.split(',') : [],
          status: 'draft',
          currency: row.currency || 'USD',
          region: row.region || 'global',
        }));
      } else {
        throw new Error(t('unsupportedFileFormat'));
      }

      const response = await fetch('/api/products/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'file',
          products,
          sellerId: session!.user!.id,
        }),
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || t('importFailed'));
      }

      toast({
        title: t('success'),
        description: t('productsImported', { count: result.data.length }),
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: error instanceof Error ? error.message : t('importFailed'),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDropshippingSearch = async () => {
    if (!selectedIntegration || !searchQuery) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: t('selectIntegrationAndQuery'),
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/seller/integrations/${selectedIntegration}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session!.user!.token}` },
        body: JSON.stringify({ query: searchQuery, region: 'global', limit: 10 }),
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || t('dropshippingFetchFailed'));
      }

      setDropshippingProducts(
        result.data.map((product: any) => ({
          id: product.productId,
          title: product.title,
          price: product.price,
          currency: product.currency || 'USD',
          imageUrl: product.imageUrl,
          sourceId: product.productId,
          sourcePlatform: integrations.find((int: any) => int._id === selectedIntegration)?.providerName || '',
        }))
      );
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: error instanceof Error ? error.message : t('dropshippingFetchFailed'),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDropshippingImport = async (product: DropshippingProduct) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/products/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session!.user!.token}` },
        body: JSON.stringify({
          provider: selectedIntegration,
          productId: product.sourceId,
          sellerId: session!.user!.id,
          region: 'global',
        }),
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || t('importFailed'));
      }

      toast({
        title: t('success'),
        description: t('productImported', { title: product.title }),
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: error instanceof Error ? error.message : t('importFailed'),
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t('importFromFile')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Input type="file" accept=".csv,.xml" onChange={handleFileChange} className="mb-4" />
          <Button onClick={handleFileImport} disabled={isLoading || !file}>
            {isLoading ? t('importing') : t('import')}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('importFromDropshipping')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Select onValueChange={setSelectedIntegration}>
            <SelectTrigger className="mb-4">
              <SelectValue placeholder={t('selectIntegration')} />
            </SelectTrigger>
            <SelectContent>
              {integrations.map((int: any) => (
                <SelectItem key={int._id} value={int._id}>
                  {int.providerName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-4 mb-4">
            <Input
              placeholder={t('searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Button onClick={handleDropshippingSearch} disabled={isLoading || !selectedIntegration}>
              {t('search')}
            </Button>
          </div>
          {dropshippingProducts.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dropshippingProducts.map((product) => (
                <Card key={product.id}>
                  <CardContent className="flex gap-4 p-4">
                    <img
                      src={product.imageUrl}
                      alt={product.title}
                      className="w-20 h-20 object-cover rounded"
                    />
                    <div>
                      <p className="font-semibold">{product.title}</p>
                      <p>
                        {product.price} {product.currency}
                      </p>
                      <Button
                        onClick={() => handleDropshippingImport(product)}
                        disabled={isLoading}
                        className="mt-2"
                      >
                        {t('import')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}