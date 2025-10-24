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
import { parseCSV, validateCSV } from '@/lib/utils/csv';
import { MarketplaceProduct } from '@/lib/types';

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
      const response = await fetch(`/api/seller/integrations?sandbox=false`);
      const result = await response.json();
      if (result.success) {
        setIntegrations(result.data.filter((int: any) => int.type === 'dropshipping' && int.status === 'connected'));
      }
    } catch (error) {
      toast({ variant: 'destructive', title: t('error'), description: t('failedToFetchIntegrations') });
    }
  };

  // معالجة CSV في الـ Client (Multiple products)
  const processCSV = (file: File) => {
    return new Promise<Partial<MarketplaceProduct>[]>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const validation = validateCSV(content, ['title', 'price', 'sku', 'quantity', 'category']);
          if (!validation.valid) {
            reject(new Error(validation.errors.join('\n')));
            return;
          }
          
          const products = parseCSV(content, { skipHeader: true }).map((row) => ({
            title: row.title,
            description: row.description || `Description for ${row.title}`,
            price: parseFloat(row.price),
            sku: row.sku || `SKU-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            countInStock: parseInt(row.quantity),
            categories: [row.category],
            images: row.images ? row.images.split(',') : [],
            status: 'draft',
            currency: row.currency || 'USD',
            region: row.region || 'global',
          }));
          
          resolve(products);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read CSV file'));
      reader.readAsText(file);
    });
  };

  // معالجة XML عبر API (Multiple products)
  const processXML = async (file: File, requiredFields: string[]) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('action', 'parse');
    formData.append('requiredFields', JSON.stringify(requiredFields));

    const response = await fetch('/api/file/xml', {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error);
    }

    return result.data.map((row: any) => ({
      title: row.title,
      description: row.description || `Description for ${row.title}`,
      price: row.price,
      sku: row.sku || `SKU-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      countInStock: row.quantity,
      categories: row.categories || [row.category],
      images: row.images || [],
      status: 'draft',
      currency: row.currency || 'USD',
      region: row.region || 'global',
    }));
  };

  // **NEW: Multiple Products Import**
  const handleFileImport = async () => {
    if (!file) {
      toast({ variant: 'destructive', title: t('error'), description: t('noFileSelected') });
      return;
    }

    setIsLoading(true);
    try {
      let products: Partial<MarketplaceProduct>[];

      if (file.name.endsWith('.csv')) {
        products = await processCSV(file);
      } else if (file.name.endsWith('.xml')) {
        products = await processXML(file, ['title', 'price', 'sku', 'quantity', 'category']);
      } else {
        throw new Error(t('unsupportedFileFormat'));
      }

      // **NEW API PAYLOAD - Multiple Products**
      const response = await fetch('/api/seller/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          products, // Array of products
          source: file.name.endsWith('.xml') ? 'xml' : 'csv',
        }),
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || t('importFailed'));
      }

      toast({
        title: t('success'),
        description: t('productsImported', { 
          count: result.data.summary.successful 
        }),
      });

      // Reset form
      setFile(null);
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      input.value = '';

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

  // **NEW: Multiple Dropshipping Import**
  const handleMultipleDropshippingImport = async () => {
    if (dropshippingProducts.length === 0) {
      toast({ variant: 'destructive', title: t('error'), description: t('noProductsSelected') });
      return;
    }

    setIsLoading(true);
    try {
      const products = dropshippingProducts.map(product => ({
        title: product.title,
        description: `Imported from ${product.sourcePlatform}`,
        price: product.price,
        countInStock: 100, // Default stock
        sku: `DS-${product.sourceId}`,
        categories: ['Dropshipping'],
        images: [product.imageUrl],
        currency: product.currency,
        sourceId: product.sourceId,
        source: 'dropshipping',
      }));

      const response = await fetch('/api/seller/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          products,
          providerId: selectedIntegration,
          source: 'dropshipping',
        }),
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || t('importFailed'));
      }

      toast({
        title: t('success'),
        description: t('productsImported', { 
          count: result.data.summary.successful 
        }),
      });

      setDropshippingProducts([]);
      setSearchQuery('');

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

  // Single dropshipping import (keep for backward compatibility)
  const handleDropshippingImport = async (product: DropshippingProduct) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/seller/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: selectedIntegration,
          productId: product.sourceId,
          source: 'dropshipping',
        }),
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || t('importFailed'));
      }

      toast({
        title: t('success'),
        description: t('productImported', { title: product.title }),
      });

      // Remove from list
      setDropshippingProducts(prev => prev.filter(p => p.id !== product.id));
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

  // باقي الكود زي ما هو...
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const handleDropshippingSearch = async () => {
    if (!selectedIntegration || !searchQuery) {
      toast({ variant: 'destructive', title: t('error'), description: t('selectIntegrationAndQuery') });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/seller/integrations/${selectedIntegration}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* File Import Section */}
      <Card>
        <CardHeader>
          <CardTitle>{t('importFromFile')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Input 
            type="file" 
            accept=".csv,.xml" 
            onChange={handleFileChange} 
            className="mb-4" 
          />
          <Button 
            onClick={handleFileImport} 
            disabled={isLoading || !file}
            className="w-full"
          >
            {isLoading ? t('importing') : `${t('import')} ${file?.name ? `(${file.name})` : ''}`}
          </Button>
        </CardContent>
      </Card>

      {/* Dropshipping Section */}
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
            <Button 
              onClick={handleDropshippingSearch} 
              disabled={isLoading || !selectedIntegration}
            >
              {t('search')}
            </Button>
          </div>

          {dropshippingProducts.length > 0 && (
            <>
              <div className="flex justify-between items-center mb-4">
                <span>{dropshippingProducts.length} {t('productsFound')}</span>
                <Button
                  onClick={handleMultipleDropshippingImport}
                  disabled={isLoading}
                  variant="outline"
                  size="sm"
                >
                  {t('importAll')}
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {dropshippingProducts.map((product) => (
                  <Card key={product.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <img
                        src={product.imageUrl}
                        alt={product.title}
                        className="w-full h-48 object-cover rounded mb-3"
                      />
                      <div className="space-y-2">
                        <h3 className="font-semibold line-clamp-2">{product.title}</h3>
                        <p className="text-lg font-bold">
                          {product.price} {product.currency}
                        </p>
                        <Button
                          onClick={() => handleDropshippingImport(product)}
                          disabled={isLoading}
                          size="sm"
                          className="w-full"
                        >
                          {t('import')}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}