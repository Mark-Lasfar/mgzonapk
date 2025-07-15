'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useTranslations, useLocale } from 'next-intl';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/toast';
import { uploadToStorage, deleteFromStorage } from '@/lib/utils/cloudinary';
// import { toSlug, logger } from '@/lib/utils';
import { createProduct } from '@/lib/actions/product.actions';
import { ProductInputSchema } from '@/lib/validator/product.validator';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { PlusCircle, Trash2, GripVertical, Plus } from 'lucide-react';
import { Steps, Step } from '@/components/ui/steps';
import { getDynamicIntegrations, DynamicIntegrationService } from '@/lib/services/integrations';
import IntegrationModel from '@/lib/db/models/integration.model';
import SellerIntegration from '@/lib/db/models/seller-integration.model';
import ProductPreview from '@/app/seller/components/product-preview';
import { readCSVFile, parseCSV, validateCSV } from '@/lib/utils/csv';
import { parseXML, validateXML, readXMLFile } from '@/lib/utils/xml';
// import { ProductImportService } from '@/lib/services/product-import';
import * as z from 'zod';
import { toSlug } from '@/lib/utils';
import { logger } from '@/lib/utils/logger';
import { ProductImportService } from '@/lib/api/services/product-import';

// Type Definitions
// interface Integration {
//   _id: string;
//   type: 'warehouse' | 'payment' | 'dropshipping' | 'marketplace' | 'shipping' | 'marketing' | 'accounting' | 'crm' | 'advertising' | 'tax' | 'other';
//   status: string;
//   providerName: string;
//   settings: { supportedCurrencies?: { global: string[] }; [key: string]: any };
//   logoUrl?: string;
// }

interface DropshippingProduct {
  id: string;
  name: string;
  price: number;
  currency: string;
  image: string;
  description?: string;
}

interface Warehouse {
  id: string;
  name: string;
  location: string;
  provider: string;
  logoUrl?: string;
}

interface PaymentMethod {
  id: string;
  name: string;
  commission: number;
}

interface ShippingProvider {
  id: string;
  name: string;
  estimatedDays: number;
}

interface Section {
  id: string;
  type: string;
  content: Record<string, any>;
  position: number;
}

// Utility Functions
const getCurrentDateTime = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

const logOperation = (operation: string, details?: any) => {
  const timestamp = getCurrentDateTime();
  logger.info(`[${timestamp}] ${operation}`, {
    ...details,
    environment: process.env.NODE_ENV || 'development',
    userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server',
  });
};

// Pricing calculation helper
const calculatePricing = (
  basePrice: number,
  listPrice: number,
  markup: number,
  discount?: { type: string; value: any },
  currency: string = 'USD'
) => {
  const commission = basePrice * 0.03; // 3% commission
  const suggestedPrice = basePrice * (1 + markup / 100);
  let suggestedMarkup = markup;

  if (listPrice > basePrice) {
    suggestedMarkup = ((listPrice - basePrice) / basePrice) * 100;
  }

  let finalPrice = listPrice || suggestedPrice;

  if (discount && discount.type !== 'none' && discount.value > 0) {
    if (discount.type === 'percentage') {
      finalPrice *= 1 - discount.value / 100;
    } else if (discount.type === 'fixed') {
      finalPrice -= discount.value;
    }
  }

  finalPrice = Math.max(finalPrice, basePrice);
  const profit = finalPrice - basePrice - commission;

  return {
    finalPrice: Number(finalPrice.toFixed(2)),
    profit: Number(profit.toFixed(2)),
    commission: Number(commission.toFixed(2)),
    suggestedMarkup: Number(suggestedMarkup.toFixed(1)),
    currency,
  };
};

// Variant Section Component
const VariantSection = ({ form, warehouseIndex }: { form: any; warehouseIndex: number }) => {
  const t = useTranslations('Seller.ProductForm');
  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: `warehouseData.${warehouseIndex}.variants`,
  });

  const updateTotalStock = useCallback(() => {
    const warehouseData = form.getValues(`warehouseData.${warehouseIndex}`);
    const totalQuantity = warehouseData?.variants.reduce((total: number, variant: any) => {
      const variantTotal = variant.options.reduce((sum: number, option: any) => sum + option.quantity, 0);
      form.setValue(`warehouseData.${warehouseIndex}.variants.${variant.index}.quantity`, variantTotal);
      form.setValue(`warehouseData.${warehouseIndex}.variants.${variant.index}.inStock`, variantTotal > 0);
      return total + variantTotal;
    }, 0) || 0;

    form.setValue(`warehouseData.${warehouseIndex}.quantity`, totalQuantity);
    form.setValue('countInStock', form.getValues('warehouseData').reduce((sum: number, wh: any) => sum + wh.quantity, 0));
    logOperation('Updated total stock', { totalQuantity, warehouseIndex });
  }, [form, warehouseIndex]);

  useEffect(() => {
    updateTotalStock();
  }, [fields, updateTotalStock]);

  const addVariant = useCallback(() => {
    append({
      name: '',
      options: [{ name: '', quantity: 0, inStock: true }],
      quantity: 0,
      inStock: true,
    });
    logOperation('Variant added', { warehouseIndex });
  }, [append, warehouseIndex]);

  const removeVariant = useCallback(
    (index: number) => {
      remove(index);
      updateTotalStock();
      logOperation('Variant removed', { index });
    },
    [remove, updateTotalStock]
  );

  return (
    <div className="space-y-4">
      <FormLabel>{t('variants')}</FormLabel>
      <Button type="button" variant="outline" onClick={addVariant} aria-label={t('addVariant')}>
        <PlusCircle className="mr-2 h-4 w-4" /> {t('addVariant')}
      </Button>
      {fields.map((field, index) => (
        <Card key={field.id}>
          <CardContent className="pt-4 space-y-4">
            <div className="flex items-center gap-2">
              <Input
                placeholder={t('variantName')}
                value={field.name}
                onChange={(e) => {
                  update(index, { ...field, name: e.target.value });
                  logOperation('Variant name updated', { name: e.target.value, index });
                }}
                aria-label={t('variantName')}
              />
              <Button
                type="button"
                variant="destructive"
                onClick={() => removeVariant(index)}
                aria-label={t('deleteVariant')}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {field.options.map((option: any, optIndex: number) => (
                <FormField
                  key={optIndex}
                  control={form.control}
                  name={`warehouseData.${warehouseIndex}.variants.${index}.options.${optIndex}.quantity`}
                  render={({ field: qtyField }) => (
                    <FormItem>
                      <FormLabel>{option.name || t('option')}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          {...qtyField}
                          value={qtyField.value || 0}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 0;
                            qtyField.onChange(value);
                            updateTotalStock();
                            logOperation('Option quantity updated', {
                              variant: field.name,
                              option: option.name,
                              quantity: value,
                              warehouseIndex,
                            });
                          }}
                          aria-label={t('optionQuantity')}
                        />
                      </FormControl>
                      <FormDescription>
                        {t('inStock')}: {qtyField.value > 0 ? t('yes') : t('no')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  update(index, {
                    ...field,
                    options: [...field.options, { name: '', quantity: 0, inStock: true }],
                  });
                  logOperation('Option added', { variant: field.name, warehouseIndex });
                }}
                aria-label={t('addOption')}
              >
                <PlusCircle className="mr-2 h-4 w-4" /> {t('addOption')}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

// Dropshipping Import Component
const DropshippingImport = ({ form, setImages }: { form: any; setImages: (images: string[]) => void }) => {
  const t = useTranslations('Seller.ProductForm');
  const { data: session } = useSession();
  const { toast } = useToast();
  const [dropshippingProviders, setDropshippingProviders] = useState<{ id: string; name: string }[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [productUrl, setProductUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const fetchProviders = useCallback(async () => {
    if (!session?.user?.id) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: t('sessionNotFound'),
      });
      return;
    }
    setIsLoading(true);
    try {
      const response = await getDynamicIntegrations(session.user.id, false);
      if (!response.success || !Array.isArray(response.data)) {
        throw new Error(t('invalidIntegrationResponse'));
      }
      const providers = response.data
        .filter((int: Integration) => int.status === 'connected' && int.type === 'dropshipping')
        .map((int: Integration) => ({ id: int._id.toString(), name: int.providerName }));
      setDropshippingProviders(providers);
      toast({
        description: t('providersFetched', { count: providers.length }),
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: error instanceof Error ? error.message : t('integrationFetchFailed'),
      });
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id, t, toast]);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  const importProduct = useCallback(async () => {
    if (!selectedProvider || !productUrl) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: t(!selectedProvider ? 'selectProvider' : 'enterProductUrl'),
      });
      return;
    }

    setIsLoading(true);
    try {
      const integration = await IntegrationModel.findOne({ _id: selectedProvider });
      if (!integration) {
        throw new Error(t('errors.invalidProvider'));
      }

      const sellerIntegration = await SellerIntegration.findOne({
        sellerId: session?.user?.id,
        integrationId: selectedProvider,
        isActive: true,
      });
      if (!sellerIntegration) {
        throw new Error(t('errors.sellerIntegrationNotFound'));
      }

      const integrationService = new DynamicIntegrationService(integration, sellerIntegration);
      const productData = await integrationService.importProduct(productUrl);

      form.setValue('name', productData.name);
      form.setValue('description', productData.description);
      form.setValue('price', productData.price);
      form.setValue('countInStock', productData.countInStock);
      form.setValue('category', productData.category);
      setImages(productData.images);
      form.setValue('warehouseData', [
        {
          warehouseId: selectedProvider,
          provider: integration.providerName,
          quantity: productData.countInStock,
          sku: productData.sku || `${toSlug(productData.name)}-${Date.now()}`,
        },
      ]);

      // Sync inventory
      const importService = new ProductImportService();
      await importService.syncInventory(productData.sourceId, session.user.id, selectedProvider);

      logOperation('Product imported from dropshipping', { provider: integration.providerName, product: productData.name });
      toast({
        description: t('productImported', { name: productData.name }),
      });
    } catch (error) {
      logOperation('Import error', { error });
      toast({
        variant: 'destructive',
        title: t('error'),
        description: error instanceof Error ? error.message : t('importFailed'),
      });
    } finally {
      setIsLoading(false);
    }
  }, [selectedProvider, productUrl, session?.user?.id, form, setImages, t, toast]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('importFromDropshipping')}</CardTitle>
      </CardHeader>
      <CardContent>
        <Select onValueChange={setSelectedProvider} disabled={isLoading} aria-label={t('selectDropshippingProvider')}>
          <SelectTrigger>
            <SelectValue placeholder={t('selectDropshippingProvider')} />
          </SelectTrigger>
          <SelectContent>
            {dropshippingProviders.map((provider) => (
              <SelectItem key={provider.id} value={provider.id}>
                {provider.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={productUrl}
          onChange={(e) => setProductUrl(e.target.value)}
          placeholder={t('productUrlPlaceholder')}
          className="mt-4"
          disabled={isLoading}
          aria-label={t('productUrl')}
        />
        <Button onClick={importProduct} className="mt-4" disabled={isLoading} aria-label={t('importProduct')}>
          {isLoading ? t('importing') : t('importProduct')}
        </Button>
      </CardContent>
    </Card>
  );
};

// Dropshipping Section Component
const DropshippingSection = ({ form, setImages }: { form: any; setImages: (images: string[]) => void }) => {
  const t = useTranslations('Seller.ProductForm');
  const { data: session } = useSession();
  const { toast } = useToast();
  const [dropshippingProducts, setDropshippingProducts] = useState<DropshippingProduct[]>([]);
  const [selectedIntegration, setSelectedIntegration] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [integrations, setIntegrations] = useState<Integration[]>([]);

  const fetchIntegrations = useCallback(async () => {
    if (!session?.user?.id) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: t('sessionNotFound'),
      });
      return;
    }
    setIsLoading(true);
    try {
      const response = await getDynamicIntegrations(session.user.id, false);
      if (!response.success || !Array.isArray(response.data)) {
        throw new Error(t('invalidIntegrationResponse'));
      }
      setIntegrations(response.data);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: error instanceof Error ? error.message : t('integrationFetchFailed'),
      });
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id, t, toast]);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  const fetchDropshippingProducts = useCallback(async () => {
    if (!selectedIntegration) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: t('selectProvider'),
      });
      return;
    }
    if (!session?.user?.token) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: t('sessionNotFound'),
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/seller/integrations/${selectedIntegration}/products`, {
        headers: { Authorization: `Bearer ${session.user.token}` },
      });
      const data = await response.json();
      if (!data.success || !Array.isArray(data.data)) {
        throw new Error(t('invalidResponse'));
      }
      setDropshippingProducts(data.data);
      toast({
        description: t('productsFetched', { count: data.data.length }),
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: error instanceof Error ? error.message : t('dropshippingFetchFailed'),
      });
    } finally {
      setIsLoading(false);
    }
  }, [selectedIntegration, session?.user?.token, t, toast]);

  const importProduct = useCallback(
    (product: DropshippingProduct) => {
      form.setValue('name', product.name);
      form.setValue('description', product.description || '');
      form.setValue('price', product.price);
      setImages([product.image]);
      logOperation('Dropshipping product selected', { id: product.id, name: product.name });
      toast({
        description: t('productImported', { name: product.name }),
      });
    },
    [form, setImages, t, toast]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('dropshipping')}</CardTitle>
      </CardHeader>
      <CardContent>
        <Select onValueChange={setSelectedIntegration} disabled={isLoading} aria-label={t('selectDropshipping')}>
          <SelectTrigger>
            <SelectValue placeholder={t('selectDropshipping')} />
          </SelectTrigger>
          <SelectContent>
            {integrations
              .filter((int: Integration) => int.type === 'dropshipping' && int.status === 'connected')
              .map((int: Integration) => (
                <SelectItem key={int._id} value={int._id}>
                  {int.providerName}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Button
          onClick={fetchDropshippingProducts}
          disabled={!selectedIntegration || isLoading}
          className="mt-4"
          aria-label={t('fetchProducts')}
        >
          {isLoading ? t('fetching') : t('fetchProducts')}
        </Button>
        {isLoading && <div className="mt-4 text-center">{t('loading')}</div>}
        {dropshippingProducts.map((product) => (
          <div key={product.id} className="flex gap-4 mt-4">
            <Image
              src={product.image}
              alt={product.name}
              width={100}
              height={100}
              className="object-cover rounded-lg"
            />
            <div>
              <p>{product.name}</p>
              <p>
                {product.price} {product.currency}
              </p>
              <Button
                onClick={() => importProduct(product)}
                disabled={isLoading}
                aria-label={t('import')}
              >
                {t('import')}
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

// CSV/XML Import Component
const FileImport = ({ form, setImages }: { form: any; setImages: (images: string[]) => void }) => {
  const t = useTranslations('Seller.ProductForm');
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileImport = useCallback(async () => {
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
      let product;
      if (file.name.endsWith('.csv')) {
        const content = await readCSVFile(file);
        const validation = validateCSV(content, ['name', 'description', 'price', 'countInStock', 'category']);
        if (!validation.valid) {
          throw new Error(validation.errors.join('; '));
        }
        const parsedData = parseCSV(content, { skipHeader: true });
        product = parsedData[0];
      } else if (file.name.endsWith('.xml')) {
        const content = await readXMLFile(file);
        const validation = validateXML(content, ['name', 'description', 'price', 'countInStock', 'category']);
        if (!validation.valid) {
          throw new Error(validation.errors.join('; '));
        }
        const parsedData = parseXML(content);
        product = parsedData[0];
      } else {
        throw new Error(t('unsupportedFileFormat'));
      }

      form.setValue('name', product.name);
      form.setValue('description', product.description);
      form.setValue('price', Number(product.price));
      form.setValue('countInStock', Number(product.countInStock));
      form.setValue('category', product.category);
      if (product.images) {
        setImages(product.images.split(',').map((s: string) => s.trim()));
      }

      logOperation('Product imported from file', { product: product.name, fileType: file.name.split('.').pop() });
      toast({
        description: t('productImported', { name: product.name }),
      });
    } catch (error) {
      logOperation('File import error', { error });
      toast({
        variant: 'destructive',
        title: t('error'),
        description: error instanceof Error ? error.message : t('importFailed'),
      });
    } finally {
      setIsLoading(false);
    }
  }, [file, form, setImages, t, toast]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('importFromFile')}</CardTitle>
      </CardHeader>
      <CardContent>
        <Input
          type="file"
          accept=".csv,.xml"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          disabled={isLoading}
          aria-label={t('selectFile')}
        />
        <Button onClick={handleFileImport} className="mt-4" disabled={isLoading} aria-label={t('importFile')}>
          {isLoading ? t('importing') : t('importFile')}
        </Button>
      </CardContent>
    </Card>
  );
};

interface ProductFormProps {
  type: 'Create' | 'Update';
  product?: z.infer<typeof ProductInputSchema>;
  productId?: string;
}

export default function ProductForm({ type, product, productId }: ProductFormProps) {
  const t = useTranslations('Seller.ProductForm');
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const { data: session } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingIntegrations, setIsLoadingIntegrations] = useState(false);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [shippingProviders, setShippingProviders] = useState<ShippingProvider[]>([]);
  const [images, setImages] = useState<string[]>(product?.images || []);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [maxImages, setMaxImages] = useState(10);
  const [categories, setCategories] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [relatedProducts, setRelatedProducts] = useState<{ _id: string; name: string }[]>([]);
  const [sections, setSections] = useState<Section[]>(product?.sections || []);
  const [currency, setCurrency] = useState('USD');
  const [supportedCurrencies, setSupportedCurrencies] = useState<string[]>(['USD', 'EUR', 'GBP', 'CAD']);
  const [currentStep, setCurrentStep] = useState(0);
  const [previewData, setPreviewData] = useState<any>({});
  const [sandboxMode, setSandboxMode] = useState(false);
  const [dynamicSources, setDynamicSources] = useState<string[]>([]);
  const [layoutOptions, setLayoutOptions] = useState<string[]>(['grid', 'list', 'carousel']);
  const [showVendor, setShowVendor] = useState(true);

  // Form setup
  const form = useForm<z.infer<typeof ProductInputSchema>>({
    resolver: zodResolver(type === 'Update' ? ProductInputSchema.partial() : ProductInputSchema),
    defaultValues: product || {
      name: '',
      slug: '',
      category: '',
      images: [],
      brand: '',
      description: '',
      price: 0,
      listPrice: 0,
      countInStock: 0,
      variants: [],
      warehouseData: [],
      pricing: {
        basePrice: 0,
        markup: 30,
        profit: 0,
        commission: 0,
        finalPrice: 0,
        discount: { type: 'none', value: 0 },
      },
      status: 'draft',
      createdBy: session?.user?.id,
      sections: [],
      relatedProducts: [],
      translations: [{ locale, name: '', description: '' }],
      featured: false,
      isPublished: false,
      tags: [],
      sizes: [],
      layout: 'grid',
    },
  });

  // Watch form values for preview
  const formValues = useWatch({ control: form.control });

  useEffect(() => {
    setPreviewData(formValues);
  }, [formValues]);

  // Fetch configurations, warehouses, and dynamic sources
  const fetchData = useCallback(async () => {
    if (!session?.user?.id || !session?.user?.token) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: t('sessionNotFound'),
      });
      return;
    }

    setIsLoadingIntegrations(true);
    try {
      // Fetch configurations
      const endpoints = ['categories', 'product-statuses', 'dynamic-sources'];
      const responses = await Promise.all(
        endpoints.map((endpoint) =>
          fetch(`/api/seller/${session.user.id}/configurations/${endpoint}`, {
            headers: { Authorization: `Bearer ${session.user.token}` },
          }).then((res) => res.json())
        )
      );

      responses.forEach((data, index) => {
        if (data.success && Array.isArray(data.data)) {
          switch (endpoints[index]) {
            case 'categories':
              setCategories(data.data);
              break;
            case 'product-statuses':
              setStatuses(data.data);
              break;
            case 'dynamic-sources':
              setDynamicSources(data.data);
              break;
          }
          logOperation(`${endpoints[index]} data fetched`, { count: data.data.length });
        } else {
          toast({
            variant: 'destructive',
            title: t('error'),
            description: t('configFetchFailed'),
          });
        }
      });

      // Fetch dynamic integrations
      const integrationResponse = await getDynamicIntegrations(session.user.id, sandboxMode);
      if (!integrationResponse.success || !Array.isArray(integrationResponse.data)) {
        throw new Error(t('invalidIntegrationResponse'));
      }
      const integrations = integrationResponse.data.filter((int: Integration) => int.status === 'connected');
      const activeWarehouses = integrations
        .filter((w: Integration) => w.type === 'warehouse')
        .map((w: Integration) => ({
          id: w._id.toString(),
          name: w.providerName,
          location: w.settings?.location || 'Unknown',
          provider: w.providerName,
          logoUrl: w.logoUrl,
        }));
      setWarehouses(activeWarehouses);

      const activePayments = integrations
        .filter((p: Integration) => p.type === 'payment')
        .map((p: Integration) => ({
          id: p._id.toString(),
          name: p.providerName,
          commission: p.settings?.commission || 0,
        }));
      setPaymentMethods(activePayments);

      const activeShipping = integrations
        .filter((s: Integration) => s.type === 'shipping')
        .map((s: Integration) => ({
          id: s._id.toString(),
          name: s.providerName,
          estimatedDays: s.settings?.estimatedDays || 3,
        }));
      setShippingProviders(activeShipping);

      // Fetch supported currencies
      const currencies = integrationResponse.data
        .flatMap((int: Integration) => int.settings?.supportedCurrencies?.global || [])
        .filter((curr: string, index: number, self: string[]) => self.indexOf(curr) === index);
      setSupportedCurrencies(currencies.length > 0 ? currencies : ['USD', 'EUR', 'GBP', 'CAD']);

      logOperation('Integrations fetched', {
        warehouses: activeWarehouses.length,
        payments: activePayments.length,
        shipping: activeShipping.length,
        currencies: currencies.length,
      });

      // Fetch related products
      const productsResponse = await fetch(`/api/seller/${session.user.id}/products`, {
        headers: { Authorization: `Bearer ${session.user.token}` },
      });
      const productsData = await productsResponse.json();
      if (productsData.success && Array.isArray(productsData.data)) {
        setRelatedProducts(productsData.data.filter((p: any) => p._id !== productId));
      } else {
        throw new Error(t('productsFetchFailed'));
      }

      // Fetch layout options
      const layoutResponse = await fetch(`/api/seller/${session.user.id}/configurations/layouts`, {
        headers: { Authorization: `Bearer ${session.user.token}` },
      });
      const layoutData = await layoutResponse.json();
      if (layoutData.success && Array.isArray(layoutData.data)) {
        setLayoutOptions(layoutData.data);
      } else {
        throw new Error(t('layoutFetchFailed'));
      }
    } catch (error) {
      logOperation('Data fetch error', { error });
      toast({
        variant: 'destructive',
        title: t('error'),
        description: error instanceof Error ? error.message : t('dataFetchFailed'),
      });
    } finally {
      setIsLoadingIntegrations(false);
    }
  }, [session?.user?.id, session?.user?.token, sandboxMode, productId, t, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Pricing calculations
  const basePrice = Number(formValues.price) || 0;
  const listPrice = Number(formValues.listPrice) || 0;
  const markup = Number(formValues.pricing?.markup) || 30;
  const discount = formValues.pricing?.discount;

  const pricing = useMemo(() => {
    return calculatePricing(basePrice, listPrice, markup, discount, currency);
  }, [basePrice, listPrice, markup, discount, currency]);

  // Section management with drag-and-drop
  const addSection = useCallback(
    (type: string) => {
      const newSection: Section = {
        id: Math.random().toString(36).substr(2, 9),
        type,
        content: {
          text: '',
          url: '',
          label: '',
          endDate: type === 'countdown' ? new Date().toISOString() : undefined,
          images: type === 'carousel' ? [] : undefined,
          reviews: type === 'reviews' ? [] : undefined,
        },
        position: sections.length,
      };
      setSections([...sections, newSection]);
      form.setValue('sections', [...sections, newSection]);
      logOperation('Section added', { type });
    },
    [sections, form]
  );

  const updateSection = useCallback(
    (index: number, field: string, value: any) => {
      const newSections = [...sections];
      newSections[index].content[field] = value;
      setSections(newSections);
      form.setValue('sections', newSections);
      logOperation('Section updated', { index, field, value });
    },
    [sections, form]
  );

  const removeSection = useCallback(
    (index: number) => {
      const newSections = sections.filter((_, i) => i !== index);
      setSections(newSections);
      form.setValue('sections', newSections);
      logOperation('Section removed', { index });
    },
    [sections, form]
  );

  const onDragEnd = useCallback(
    (result: any) => {
      if (!result.destination) return;
      const newSections = Array.from(sections);
      const [reorderedItem] = newSections.splice(result.source.index, 1);
      newSections.splice(result.destination.index, 0, reorderedItem);
      newSections.forEach((section, idx) => (section.position = idx));
      setSections(newSections);
      form.setValue('sections', newSections);
      logOperation('Sections reordered', { newOrder: newSections.map((s) => s.id) });
    },
    [sections, form]
  );

  // Drag-and-drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Image upload handler
  const handleImageUpload = useCallback(
    async (files: File[]) => {
      if (files.length === 0) {
        toast({
          variant: 'destructive',
          title: t('error'),
          description: t('noFilesSelected'),
        });
        return;
      }

      if (images.length + files.length > maxImages) {
        toast({
          variant: 'destructive',
          title: t('tooManyImages'),
          description: t('maxImages', { max: maxImages }),
        });
        return;
      }

      // Create temporary preview URLs
      const tempUrls = Array.from(files).map((file) => URL.createObjectURL(file));
      setPreviewUrls([...previewUrls, ...tempUrls]);

      setIsUploading(true);
      try {
        const uploadedUrls = await Promise.all(
          files.map((file) =>
            uploadToStorage(file, `products/${Date.now()}-${file.name}`, {
              folder: 'products',
              allowedFormats: ['image/jpeg', 'image/png'],
              maxSize: 5 * 1024 * 1024,
            })
          )
        );
        setImages([...images, ...uploadedUrls]);
        form.setValue('images', [...images, ...uploadedUrls]);
        logOperation('Images uploaded', { urls: uploadedUrls });
        toast({
          description: t('imagesUploaded', { count: uploadedUrls.length }),
        });
      } catch (error) {
        logOperation('Image upload error', { error });
        toast({
          variant: 'destructive',
          title: t('error'),
          description: error instanceof Error ? error.message : t('imageUploadFailed'),
        });
      } finally {
        setIsUploading(false);
        tempUrls.forEach((url) => URL.revokeObjectURL(url));
        setPreviewUrls([]);
      }
    },
    [images, maxImages, previewUrls, form, t, toast]
  );

  // Image delete handler
  const handleImageDelete = useCallback(
    async (image: string, index: number) => {
      if (!confirm(t('confirmDeleteImage'))) {
        return;
      }

      setIsUploading(true);
      try {
        const publicId = image.split('/').pop()?.split('.')[0] || '';
        await deleteFromStorage(publicId);
        const newImages = images.filter((_, i) => i !== index);
        setImages(newImages);
        form.setValue('images', newImages);
        logOperation('Image deleted', { image, index });
        toast({
          description: t('imageDeleted'),
        });
      } catch (error) {
        logOperation('Image delete error', { error });
        toast({
          variant: 'destructive',
          title: t('error'),
          description: error instanceof Error ? error.message : t('imageDeleteFailed'),
        });
      } finally {
        setIsUploading(false);
      }
    },
    [images, form, t, toast]
  );

  // Form submission
  const onSubmit = useCallback(
    async (values: z.infer<typeof ProductInputSchema>) => {
      setIsSubmitting(true);
      const currentUser = session?.user?.id || 'unknown';

      logOperation('Form submission started', { user: currentUser, type, productId });

      try {
        // Check product limit
        const productCountResponse = await fetch(`/api/seller/${currentUser}/products/count`, {
          headers: { Authorization: `Bearer ${session.user.token}` },
        });
        const productCountData = await productCountResponse.json();
        if (productCountData.count >= productCountData.maxProducts) {
          toast({
            variant: 'destructive',
            title: t('error'),
            description: t('productLimitReached'),
          });
          return;
        }

        if (!images.length) {
          toast({
            variant: 'destructive',
            title: t('imagesRequired'),
            description: t('addAtLeastOneImage'),
          });
          return;
        }

        if (!values.warehouseData?.length) {
          toast({
            variant: 'destructive',
            title: t('warehouseRequired'),
            description: t('selectAtLeastOneWarehouse'),
          });
          return;
        }

        const submissionData = {
          ...values,
          images,
          name: values.name.trim(),
          slug: values.slug.trim(),
          category: values.category.trim(),
          brand: values.brand?.trim() || '',
          description: values.description.trim(),
          price: Number(values.price),
          listPrice: Number(values.listPrice) || Number(values.price),
          countInStock: Number(values.countInStock),
          variants: values.variants || [],
          warehouseData: values.warehouseData.map((wh: any) => ({
            ...wh,
            sku: wh.sku || `${toSlug(values.name)}-${wh.provider}-${Date.now()}`,
            lastUpdated: new Date(),
            updatedBy: currentUser,
          })),
          pricing: {
            basePrice: Number(values.price),
            markup: Number(pricing.suggestedMarkup || values.pricing?.markup || 30),
            finalPrice: pricing.finalPrice,
            profit: pricing.profit,
            commission: pricing.commission,
            discount: {
              type: values.pricing?.discount?.type || 'none',
              value: Number(values.pricing?.discount?.value) || 0,
              startDate: values.pricing?.discount?.startDate,
              endDate: values.pricing?.discount?.endDate,
            },
            currency,
          },
          status: values.status || 'draft',
          createdBy: currentUser,
          updatedBy: currentUser,
          createdAt: new Date(),
          updatedAt: new Date(),
          sections,
          showVendor,
          layout: values.layout || 'grid',
        };

        const res = await createProduct(submissionData);

        if (!res.success) {
          toast({
            variant: 'destructive',
            title: t('creationFailed'),
            description: res.message || t('unexpectedError'),
          });
          return;
        }

        // Sync with warehouse integrations
        for (const wh of submissionData.warehouseData) {
          const warehouse = warehouses.find((w) => w.id === wh.warehouseId);
          if (warehouse) {
            const integration = await IntegrationModel.findOne({ _id: wh.warehouseId });
            if (integration) {
              const sellerIntegration = await SellerIntegration.findOne({
                sellerId: session.user.id,
                integrationId: wh.warehouseId,
                isActive: true,
              });
              if (sellerIntegration) {
                const integrationService = new DynamicIntegrationService(integration, sellerIntegration);
                await integrationService.createProduct({
                  externalId: res.data._id,
                  name: submissionData.name,
                  sku: wh.sku,
                  quantity: wh.quantity,
                  price: submissionData.pricing.finalPrice,
                });
              }
            }
          }
        }

        toast({
          title: t('success'),
          description: t('productCreatedSuccessfully'),
        });

        router.push('/seller/dashboard/products');
        router.refresh();
      } catch (error) {
        logOperation('Form submission error', { error });
        toast({
          variant: 'destructive',
          title: t('error'),
          description: error instanceof Error ? error.message : t('unexpectedError'),
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [session?.user?.id, session?.user?.token, type, productId, images, pricing, currency, sections, showVendor, warehouses, form, router, t, toast]
  );

  const addTranslation = useCallback(() => {
    form.setValue('translations', [
      ...form.getValues('translations'),
      { locale: '', name: '', description: '' },
    ]);
    logOperation('Translation added');
  }, [form]);

  const removeTranslation = useCallback(
    (index: number) => {
      const translations = form.getValues('translations').filter((_, i) => i !== index);
      form.setValue('translations', translations);
      logOperation('Translation removed', { index });
    },
    [form]
  );

  const steps = [
    { title: t('basicInformation'), key: 'basic' },
    { title: t('pricing'), key: 'pricing' },
    { title: t('warehouses'), key: 'warehouses' },
    { title: t('productImages'), key: 'images' },
    { title: t('dynamicSections'), key: 'sections' },
    { title: t('relatedProducts'), key: 'related' },
    { title: t('layoutSettings'), key: 'layout' },
    { title: t('translations'), key: 'translations' },
    { title: t('importOptions'), key: 'import' },
    { title: t('dropshipping'), key: 'dropshipping' },
  ];

  return (
    <div className="container mx-auto p-6" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex justify-end mb-4">
        <Select
          onValueChange={(value) => {
            setSandboxMode(value === 'true');
            toast({
              description: t(value === 'true' ? 'switchedToSandbox' : 'switchedToLive'),
            });
          }}
          aria-label={t('environment')}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t('environment')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="false">{t('live')}</SelectItem>
            <SelectItem value="true">{t('sandbox')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Steps current={currentStep} onChange={setCurrentStep}>
        {steps.map((step) => (
          <Step key={step.key} title={step.title} />
        ))}
      </Steps>
      <div className="flex gap-6 mt-6">
        <div className="w-2/3">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              {currentStep === 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>{t('basicInformation')}</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-6 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('productName')}</FormLabel>
                          <FormControl>
                            <Input
                              placeholder={t('namePlaceholder')}
                              {...field}
                              onChange={(e) => {
                                field.onChange(e);
                                form.setValue('slug', toSlug(e.target.value));
                                logOperation('Product name changed', { value: e.target.value });
                              }}
                              aria-label={t('productName')}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="slug"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('slug')}</FormLabel>
                          <div className="flex gap-2">
                            <FormControl>
                              <Input
                                placeholder={t('slugPlaceholder')}
                                {...field}
                                onChange={(e) => {
                                  field.onChange(e);
                                  logOperation('Slug changed', { value: e.target.value });
                                }}
                                aria-label={t('slug')}
                              />
                            </FormControl>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                const newSlug = toSlug(form.getValues('name'));
                                form.setValue('slug', newSlug);
                                logOperation('Slug generated', { value: newSlug });
                              }}
                              aria-label={t('generate')}
                            >
                              {t('generate')}
                            </Button>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('category')}</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={(value) => {
                              field.onChange(value);
                              logOperation('Category changed', { value });
                            }}
                            aria-label={t('category')}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t('categoryPlaceholder')} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {categories.map((category) => (
                                <SelectItem key={category} value={category}>
                                  {category}
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
                      name="brand"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('brand')}</FormLabel>
                          <FormControl>
                            <Input
                              placeholder={t('brandPlaceholder')}
                              {...field}
                              onChange={(e) => {
                                field.onChange(e);
                                logOperation('Brand changed', { value: e.target.value });
                              }}
                              aria-label={t('brand')}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>{t('description')}</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder={t('descriptionPlaceholder')}
                              className="min-h-[150px]"
                              {...field}
                              onChange={(e) => {
                                field.onChange(e);
                                logOperation('Description updated', { length: e.target.value.length });
                              }}
                              aria-label={t('description')}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="featured"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2">
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              aria-label={t('featured')}
                            />
                          </FormControl>
                          <FormLabel>{t('featured')}</FormLabel>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="isPublished"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2">
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              aria-label={t('isPublished')}
                            />
                          </FormControl>
                          <FormLabel>{t('isPublished')}</FormLabel>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              )}
              {currentStep === 1 && (
                <Card>
                  <CardHeader>
                    <CardTitle>{t('pricing')}</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-6 md:grid-cols-3">
                    <FormField
                      control={form.control}
                      name="price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('basePrice')}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              {...field}
                              onChange={(e) => {
                                const value = parseFloat(e.target.value) || 0;
                                field.onChange(value);
                                logOperation('Base price changed', { value });
                                const currentListPrice = form.getValues('listPrice');
                                if (!currentListPrice || currentListPrice < value) {
                                  form.setValue('listPrice', value);
                                  logOperation('List price updated', { value });
                                }
                              }}
                              aria-label={t('basePrice')}
                            />
                          </FormControl>
                          <FormDescription>
                            {t('yourCost')}: {pricing.currency} {Number(field.value).toFixed(2)}
                            <br />
                            <small className="text-muted-foreground">
                              {t('commission')}: {pricing.currency} {pricing.commission}
                            </small>
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="listPrice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('listPrice')}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              {...field}
                              onChange={(e) => {
                                const value = parseFloat(e.target.value) || 0;
                                field.onChange(value);
                                logOperation('List price changed', { value });
                                const basePrice = form.getValues('price');
                                if (basePrice && value > basePrice) {
                                  const suggestedMarkup = ((value - basePrice) / basePrice) * 100;
                                  form.setValue('pricing.markup', suggestedMarkup);
                                  logOperation('Markup updated', { suggestedMarkup });
                                }
                              }}
                              aria-label={t('listPrice')}
                            />
                          </FormControl>
                          <FormDescription>
                            {t('msrp')}: {pricing.currency} {Number(field.value).toFixed(2)}
                            <br />
                            <small className="text-muted-foreground">
                              {t('suggestedMarkup')}: {pricing.suggestedMarkup}%
                            </small>
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="pricing.markup"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('markup')}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              max="100"
                              placeholder="30"
                              {...field}
                              value={field.value || pricing.suggestedMarkup}
                              onChange={(e) => {
                                const value = parseFloat(e.target.value) || 30;
                                field.onChange(value);
                                logOperation('Markup changed', { value });
                              }}
                              aria-label={t('markup')}
                            />
                          </FormControl>
                          <FormDescription>
                            {t('finalPrice')}: {pricing.currency} {pricing.finalPrice}
                            <br />
                            <small className="text-muted-foreground">
                              {t('estProfit')}: {pricing.currency} {pricing.profit}
                            </small>
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="pricing.discount.type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('discountType')}</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={(value) => {
                              field.onChange(value);
                              logOperation('Discount type changed', { value });
                            }}
                            aria-label={t('discountType')}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t('selectDiscountType')} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {['none', 'percentage', 'fixed'].map((type) => (
                                <SelectItem key={type} value={type}>
                                  {t(type)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {form.watch('pricing.discount.type') !== 'none' && (
                      <>
                        <FormField
                          control={form.control}
                          name="pricing.discount.value"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('discountValue')}</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step={form.watch('pricing.discount.type') === 'percentage' ? '1' : '0.01'}
                                  min="0"
                                  max={form.watch('pricing.discount.type') === 'percentage' ? '100' : undefined}
                                  placeholder={form.watch('pricing.discount.type') === 'percentage' ? '10' : '5.00'}
                                  {...field}
                                  onChange={(e) => {
                                    const value = parseFloat(e.target.value) || 0;
                                    field.onChange(value);
                                    logOperation('Discount value changed', {
                                      value,
                                      type: form.watch('pricing.discount.type'),
                                    });
                                  }}
                                  aria-label={t('discountValue')}
                                />
                              </FormControl>
                              <FormDescription>
                                {form.watch('pricing.discount.type') === 'percentage'
                                  ? t('enterPercentage')
                                  : t('enterAmount')}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="pricing.discount.startDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('startDate')}</FormLabel>
                              <FormControl>
                                <Input
                                  type="datetime-local"
                                  {...field}
                                  value={field.value ? new Date(field.value).toISOString().slice(0, 16) : ''}
                                  onChange={(e) => {
                                    field.onChange(e.target.value ? new Date(e.target.value) : undefined);
                                    logOperation('Discount start date changed', { value: e.target.value });
                                  }}
                                  aria-label={t('startDate')}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="pricing.discount.endDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('endDate')}</FormLabel>
                              <FormControl>
                                <Input
                                  type="datetime-local"
                                  {...field}
                                  value={field.value ? new Date(field.value).toISOString().slice(0, 16) : ''}
                                  onChange={(e) => {
                                    field.onChange(e.target.value ? new Date(e.target.value) : undefined);
                                    logOperation('Discount end date changed', { value: e.target.value });
                                  }}
                                  aria-label={t('endDate')}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    )}
                    <FormField
                      control={form.control}
                      name="pricing.currency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('currency')}</FormLabel>
                          <Select
                            value={currency}
                            onValueChange={(value) => {
                              setCurrency(value);
                              logOperation('Currency changed', { value });
                            }}
                            aria-label={t('currency')}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t('selectCurrency')} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {supportedCurrencies.map((curr) => (
                                <SelectItem key={curr} value={curr}>
                                  {curr}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              )}
              {currentStep === 2 && (
                <Card>
                  <CardHeader>
                    <CardTitle>{t('warehouses')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isLoadingIntegrations ? (
                      <div className="text-center py-6">{t('loading')}</div>
                    ) : warehouses.length === 0 ? (
                      <div className="text-center py-6">
                        <p className="text-muted-foreground mb-4">{t('noWarehousesActivated')}</p>
                        <Button
                          onClick={() => router.push('/seller/dashboard/integrations')}
                          variant="outline"
                          aria-label={t('goToIntegrations')}
                        >
                          {t('goToIntegrations')}
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                          {warehouses.map((warehouse, index) => (
                            <Card key={warehouse.id}>
                              <CardContent className="pt-6">
                                <div className="flex items-center gap-4">
                                  {warehouse.logoUrl ? (
                                    <Image
                                      src={warehouse.logoUrl}
                                      alt={`${warehouse.provider} logo`}
                                      width={40}
                                      height={40}
                                      className="object-contain"
                                    />
                                  ) : (
                                    <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center">
                                      <span className="text-sm">{warehouse.provider[0]}</span>
                                    </div>
                                  )}
                                  <div>
                                    <h3 className="font-semibold">{warehouse.name}</h3>
                                    <p className="text-sm text-muted-foreground">
                                      {warehouse.provider} - {warehouse.location}
                                    </p>
                                  </div>
                                </div>
                                <FormField
                                  control={form.control}
                                  name={`warehouseData.${index}.warehouseId`}
                                  render={({ field }) => (
                                    <FormItem className="mt-4">
                                      <FormControl>
                                        <Button
                                          type="button"
                                          variant={field.value === warehouse.id ? 'default' : 'outline'}
                                          className="w-full"
                                          onClick={() => {
                                            const warehouseData = form.getValues('warehouseData') || [];
                                            warehouseData[index] = {
                                              warehouseId: warehouse.id,
                                              provider: warehouse.provider,
                                              location: warehouse.location,
                                              sku: '',
                                              quantity: 0,
                                              minimumStock: 5,
                                              reorderPoint: 10,
                                              variants: [],
                                            };
                                            form.setValue('warehouseData', warehouseData);
                                            logOperation('Warehouse selected', {
                                              id: warehouse.id,
                                              name: warehouse.name,
                                              index,
                                            });
                                          }}
                                          aria-label={field.value === warehouse.id ? t('selected') : t('select')}
                                        >
                                          {field.value === warehouse.id ? t('selected') : t('select')}
                                        </Button>
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                        {warehouses.map((warehouse, index) => (
                          form.getValues(`warehouseData.${index}.warehouseId`) && (
                            <div key={warehouse.id} className="grid gap-6 md:grid-cols-2 mt-6">
                              <FormField
                                control={form.control}
                                name={`warehouseData.${index}.sku`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>{t('sku')}</FormLabel>
                                    <FormControl>
                                      <Input
                                        placeholder={t('skuPlaceholder')}
                                        {...field}
                                        onChange={(e) => {
                                          field.onChange(e);
                                          logOperation('SKU changed', { value: e.target.value, index });
                                        }}
                                        aria-label={t('sku')}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name={`warehouseData.${index}.location`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>{t('location')}</FormLabel>
                                    <FormControl>
                                      <Input
                                        placeholder={t('locationPlaceholder')}
                                        {...field}
                                        readOnly
                                        aria-label={t('location')}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name={`warehouseData.${index}.minimumStock`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>{t('minimumStock')}</FormLabel>
                                    <FormControl>
                                      <Input
                                        type="number"
                                        min="0"
                                        {...field}
                                        value={field.value || 0}
                                        onChange={(e) => {
                                          const value = parseInt(e.target.value) || 0;
                                          field.onChange(value);
                                          logOperation('Minimum stock changed', { value, index });
                                        }}
                                        aria-label={t('minimumStock')}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name={`warehouseData.${index}.reorderPoint`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>{t('reorderPoint')}</FormLabel>
                                    <FormControl>
                                      <Input
                                        type="number"
                                        min="0"
                                        {...field}
                                        value={field.value || 0}
                                        onChange={(e) => {
                                          const value = parseInt(e.target.value) || 0;
                                          field.onChange(value);
                                          logOperation('Reorder point changed', { value, index });
                                        }}
                                        aria-label={t('reorderPoint')}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <VariantSection form={form} warehouseIndex={index} />
                            </div>
                          )
                        ))}
                      </>
                    )}
                  </CardContent>
                </Card>
              )}
              {currentStep === 3 && (
                <Card>
                  <CardHeader>
                    <CardTitle>{t('productImages')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isUploading && <div className="text-center mb-4">{t('uploading')}</div>}
                    <div className="flex flex-wrap gap-4">
                      {images.map((image, index) => (
                        <Card key={index} className="relative w-[150px] h-[150px]">
                          <CardContent className="p-0">
                            <Image
                              src={image}
                              alt={`${t('productImage')} ${index + 1}`}
                              width={150}
                              height={150}
                              className="object-cover rounded-lg"
                            />
                            <Button
                              variant="destructive"
                              size="icon"
                              className="absolute top-2 right-2"
                              onClick={() => handleImageDelete(image, index)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  handleImageDelete(image, index);
                                }
                              }}
                              aria-label={t('deleteImage')}
                              disabled={isUploading}
                            >
                              ×
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                      {previewUrls.map((url, index) => (
                        <Card key={`preview-${index}`} className="relative w-[150px] h-[150px] opacity-50">
                          <CardContent className="p-0">
                            <Image
                              src={url}
                              alt={`${t('previewImage')} ${index + 1}`}
                              width={150}
                              height={150}
                              className="object-cover rounded-lg"
                            />
                          </CardContent>
                        </Card>
                      ))}
                      {images.length + previewUrls.length < maxImages && (
                        <Card className="w-[150px] h-[150px] flex items-center justify-center">
                          <CardContent className="p-0">
                            <Input
                              type="file"
                              accept="image/jpeg,image/png"
                              multiple
                              onChange={(e) => {
                                if (e.target.files) {
                                  handleImageUpload(Array.from(e.target.files));
                                }
                              }}
                              disabled={isUploading}
                              aria-label={t('uploadImages')}
                            />
                          </CardContent>
                        </Card>
                      )}
                    </div>
                    <FormDescription>{t('imageRequirements')}</FormDescription>
                    <FormMessage />
                  </CardContent>
                </Card>
              )}
              {currentStep === 4 && (
                <Card>
                  <CardHeader>
                    <CardTitle>{t('dynamicSections')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd} sensors={sensors}>
                      <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                        {sections.map((section, index) => (
                          <div key={section.id} className="flex items-center space-x-2 mb-3">
                            <GripVertical className="h-5 w-5 cursor-move" aria-label={t('dragHandle')} />
                            {section.type === 'text' && (
                              <Input
                                value={section.content.text || ''}
                                onChange={(e) => updateSection(index, 'text', e.target.value)}
                                placeholder={t('sectionContent')}
                                aria-label={t('textSection')}
                              />
                            )}
                            {section.type === 'image' && (
                              <Input
                                value={section.content.url || ''}
                                onChange={(e) => updateSection(index, 'url', e.target.value)}
                                placeholder={t('imageUrl')}
                                aria-label={t('imageSection')}
                              />
                            )}
                            {section.type === 'video' && (
                              <Input
                                value={section.content.url || ''}
                                onChange={(e) => updateSection(index, 'url', e.target.value)}
                                placeholder={t('videoUrl')}
                                aria-label={t('videoSection')}
                              />
                            )}
                            {section.type === 'button' && (
                              <>
                                <Input
                                  value={section.content.label || ''}
                                  onChange={(e) => updateSection(index, 'label', e.target.value)}
                                  placeholder={t('buttonLabel')}
                                  aria-label={t('buttonLabel')}
                                />
                                <Input
                                  value={section.content.url || ''}
                                  onChange={(e) => updateSection(index, 'url', e.target.value)}
                                  placeholder={t('buttonUrl')}
                                  aria-label={t('buttonUrl')}
                                />
                              </>
                            )}
                            {section.type === 'carousel' && (
                              <Input
                                value={section.content.images?.join(',') || ''}
                                onChange={(e) =>
                                  updateSection(index, 'images', e.target.value.split(',').map((s: string) => s.trim()))
                                }
                                placeholder={t('carouselImages')}
                                aria-label={t('carouselSection')}
                              />
                            )}
                            {section.type === 'countdown' && (
                              <Input
                                type="datetime-local"
                                value={
                                  section.content.endDate ? new Date(section.content.endDate).toISOString().slice(0, 16) : ''
                                }
                                onChange={(e) => updateSection(index, 'endDate', e.target.value)}
                                placeholder={t('countdownEndDate')}
                                aria-label={t('countdownSection')}
                              />
                            )}
                            {section.type === 'reviews' && (
                              <Input
                                value={section.content.reviews?.length || 0}
                                readOnly
                                placeholder={t('reviewsCount')}
                                aria-label={t('reviewsSection')}
                              />
                            )}
                            <Button
                              type="button"
                              variant="destructive"
                              onClick={() => removeSection(index)}
                              aria-label={t('deleteSection')}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </SortableContext>
                    </DndContext>
                    <Select onValueChange={(value) => addSection(value)} aria-label={t('addSection')}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('addSection')} />
                      </SelectTrigger>
                      <SelectContent>
                        {['text', 'image', 'video', 'button', 'carousel', 'countdown', 'reviews'].map((type) => (
                          <SelectItem key={type} value={type}>
                            {t(type)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>
              )}
              {currentStep === 5 && (
                <Card>
                  <CardHeader>
                    <CardTitle>{t('relatedProducts')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FormField
                      control={form.control}
                      name="relatedProducts"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('relatedProducts')}</FormLabel>
                          <FormControl>
                            <Select
                              value={field.value?.[0] || ''}
                              onValueChange={(value) => {
                                const currentRelated = field.value || [];
                                if (!currentRelated.includes(value)) {
                                  field.onChange([...currentRelated, value]);
                                  logOperation('Related product added', { value });
                                }
                              }}
                              aria-label={t('selectRelatedProduct')}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={t('selectRelatedProduct')} />
                              </SelectTrigger>
                              <SelectContent>
                                {relatedProducts.map((product) => (
                                  <SelectItem key={product._id} value={product._id}>
                                    {product.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <div className="mt-2">
                            {field.value?.map((id, index) => (
                              <div key={index} className="flex items-center gap-2 mb-2">
                                <span>{relatedProducts.find((p) => p._id === id)?.name || id}</span>
                                <Button
                                  type="button"
                                  variant="destructive"
                                  onClick={() => {
                                    field.onChange(field.value.filter((_, i) => i !== index));
                                    logOperation('Related product removed', { index });
                                  }}
                                  aria-label={t('deleteRelatedProduct')}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                          <FormDescription>{t('relatedProductsDescription')}</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              )}
              {currentStep === 6 && (
                <Card>
                  <CardHeader>
                    <CardTitle>{t('layoutSettings')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FormField
                      control={form.control}
                      name="layout"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('layout')}</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={(value) => {
                              field.onChange(value);
                              logOperation('Layout changed', { value });
                            }}
                            aria-label={t('layout')}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t('selectLayout')} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {layoutOptions.map((layout) => (
                                <SelectItem key={layout} value={layout}>
                                  {t(layout)}
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
                      name="showVendor"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2 mt-4">
                          <FormControl>
                            <Switch
                              checked={showVendor}
                              onCheckedChange={(value) => {
                                setShowVendor(value);
                                field.onChange(value);
                                logOperation('Show vendor toggled', { value });
                              }}
                              aria-label={t('showVendor')}
                            />
                          </FormControl>
                          <FormLabel>{t('showVendor')}</FormLabel>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        router.push('/seller/dashboard/templates/new');
                        logOperation('Create new template');
                      }}
                      aria-label={t('createNewTemplate')}
                    >
                      {t('createNewTemplate')}
                    </Button>
                  </CardContent>
                </Card>
              )}
              {currentStep === 7 && (
                <Card>
                  <CardHeader>
                    <CardTitle>{t('translations')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {form.getValues('translations').map((_: any, index: number) => (
                      <div key={index} className="grid gap-4 md:grid-cols-3 mb-4">
                        <FormField
                          control={form.control}
                          name={`translations.${index}.locale`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('locale')}</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder={t('localePlaceholder')}
                                  {...field}
                                  onChange={(e) => {
                                    field.onChange(e);
                                    logOperation('Translation locale changed', { value: e.target.value, index });
                                  }}
                                  aria-label={t('locale')}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`translations.${index}.name`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('translatedName')}</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder={t('namePlaceholder')}
                                  {...field}
                                  onChange={(e) => {
                                    field.onChange(e);
                                    logOperation('Translated name changed', { value: e.target.value, index });
                                  }}
                                  aria-label={t('translatedName')}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`translations.${index}.description`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('translatedDescription')}</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder={t('descriptionPlaceholder')}
                                  {...field}
                                  onChange={(e) => {
                                    field.onChange(e);
                                    logOperation('Translated description changed', { length: e.target.value.length, index });
                                  }}
                                  aria-label={t('translatedDescription')}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={() => removeTranslation(index)}
                          className="mt-8"
                          aria-label={t('removeTranslation')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addTranslation}
                      aria-label={t('addTranslation')}
                    >
                      <PlusCircle className="mr-2 h-4 w-4" /> {t('addTranslation')}
                    </Button>
                  </CardContent>
                </Card>
              )}
              {currentStep === 8 && (
                <Card>
                  <CardHeader>
                    <CardTitle>{t('importOptions')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FileImport form={form} setImages={setImages} />
                  </CardContent>
                </Card>
              )}
              {currentStep === 9 && (
                <Card>
                  <CardHeader>
                    <CardTitle>{t('dropshipping')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <DropshippingSection form={form} setImages={setImages} />
                    <DropshippingImport form={form} setImages={setImages} />
                  </CardContent>
                </Card>
              )}
              <div className="flex justify-between mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (currentStep > 0) {
                      setCurrentStep(currentStep - 1);
                      logOperation('Previous step', { step: currentStep - 1 });
                    }
                  }}
                  disabled={currentStep === 0 || isSubmitting}
                  aria-label={t('previous')}
                >
                  {t('previous')}
                </Button>
                {currentStep < steps.length - 1 ? (
                  <Button
                    type="button"
                    onClick={() => {
                      setCurrentStep(currentStep + 1);
                      logOperation('Next step', { step: currentStep + 1 });
                    }}
                    disabled={isSubmitting}
                    aria-label={t('next')}
                  >
                    {t('next')}
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={isSubmitting || isUploading}
                    aria-label={t('submit')}
                  >
                    {isSubmitting ? t('submitting') : t('submit')}
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </div>
        <div className="w-1/3">
          <Card>
            <CardHeader>
              <CardTitle>{t('preview')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ProductPreview
                product={{
                  ...previewData,
                  images,
                  pricing: {
                    ...previewData.pricing,
                    finalPrice: pricing.finalPrice,
                    profit: pricing.profit,
                    commission: pricing.commission,
                    currency,
                  },
                  sections,
                  showVendor,
                }}
              />
            </CardContent>
          </Card>
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>{t('status')}</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('status')}</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        logOperation('Status changed', { value });
                      }}
                      aria-label={t('status')}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('selectStatus')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {statuses.map((status) => (
                          <SelectItem key={status} value={status}>
                            {t(status)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>{t('paymentMethods')}</CardTitle>
            </CardHeader>
            <CardContent>
              {paymentMethods.map((method) => (
                <div key={method.id} className="flex items-center gap-2 mb-2">
                  <span>{method.name}</span>
                  <span className="text-sm text-muted-foreground">
                    ({t('commission')}: {method.commission}%)
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>{t('shippingProviders')}</CardTitle>
            </CardHeader>
            <CardContent>
              {shippingProviders.map((provider) => (
                <div key={provider.id} className="flex items-center gap-2 mb-2">
                  <span>{provider.name}</span>
                  <span className="text-sm text-muted-foreground">
                    ({t('estimatedDays')}: {provider.estimatedDays})
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}