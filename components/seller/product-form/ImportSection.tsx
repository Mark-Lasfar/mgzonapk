// /components/seller/product-form/ImportSection.tsx
'use client';

import { useTranslations } from 'next-intl';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { ProductInput } from '@/lib/types';
import { useState } from 'react';
import { useSession } from 'next-auth/react';

interface ParsedProduct {
  title: string;
  description?: string;
  price: number;
  quantity: number;
  sku?: string;
  category?: string;
  images?: string[];
  currency?: string;
}

interface ImportSectionProps {
  onImport: (products: Partial<ProductInput>[]) => void; // Multiple products
}

export default function ImportSection({ onImport }: ImportSectionProps) {
  const t = useTranslations('Seller.ProductForm');
  const { toast } = useToast();
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(false);

  const handleFileImport = async (file: File | null) => {
    if (!file) {
      toast({ variant: 'destructive', title: t('error'), description: t('noFileSelected') });
      return;
    }

    setIsLoading(true);
    try {
      let products: ParsedProduct[];

      if (file.name.endsWith('.csv')) {
        // CSV processing (Multiple products)
        const content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsText(file);
        });

        // Simple CSV parsing for multiple products
        const lines = content.split('\n').filter(line => line.trim());
        if (lines.length < 2) throw new Error('Invalid CSV format');
        
        const headers = lines[0].split(',');
        products = lines.slice(1).map(line => {
          const values = line.split(',');
          const data: any = {};
          
          headers.forEach((header, i) => {
            data[header.trim()] = values[i]?.trim();
          });

          return {
            title: data.title || data.name,
            description: data.description,
            price: parseFloat(data.price),
            quantity: parseInt(data.quantity) || parseInt(data.countInStock) || 0,
            sku: data.sku,
            category: data.category,
            images: data.images ? data.images.split(',') : [],
            currency: data.currency || 'USD',
          };
        }).filter(p => p.title && !isNaN(p.price));

      } else if (file.name.endsWith('.xml')) {
        // XML processing via API (Multiple products)
        const formData = new FormData();
        formData.append('file', file);
        formData.append('action', 'parse');
        formData.append('requiredFields', JSON.stringify([
          'title', 'price', 'sku', 'quantity', 'category'
        ]));

        const response = await fetch('/api/file/xml', {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();
        if (!result.success || !result.data.length) {
          throw new Error(result.error || 'Invalid XML format');
        }

        products = result.data;
      } else {
        throw new Error(t('unsupportedFileFormat'));
      }

      if (!products.length) {
        throw new Error('No valid products found');
      }

      // Convert to ProductInput format
      const importedProducts: Partial<ProductInput>[] = products.map(product => ({
        title: product.title,
        description: product.description || `Description for ${product.title}`,
        price: product.price,
        countInStock: product.quantity,
        sku: product.sku || `SKU-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        category: product.category || 'Uncategorized',
        images: product.images || [],
        currency: product.currency,
      }));

      // Call parent with MULTIPLE products
      onImport(importedProducts);
      
      toast({ 
        description: t('productsImported', { count: importedProducts.length }) 
      });

    } catch (error) {
      toast({ 
        variant: 'destructive', 
        title: t('error'), 
        description: error instanceof Error ? error.message : t('importFailed') 
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold">{t('importOptions')}</h2>
      </CardHeader>
      <CardContent>
        <input
          type="file"
          accept=".csv,.xml"
          onChange={(e) => handleFileImport(e.target.files?.[0] || null)}
          disabled={isLoading}
          aria-label={t('selectFile')}
          id="file-import"
          className="hidden"
        />
        <label htmlFor="file-import">
          <Button
            asChild
            disabled={isLoading}
            className="mt-4 w-full"
          >
            <span>{isLoading ? t('processing') : t('importFile')}</span>
          </Button>
        </label>
      </CardContent>
    </Card>
  );
}