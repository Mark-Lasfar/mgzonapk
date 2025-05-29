'use client'

import { zodResolver } from '@hookform/resolvers/zod';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useSession } from 'next-auth/react';
import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { createProduct } from '@/lib/actions/product.actions';
import { syncWithWarehouse } from '@/lib/actions/warehouse.actions';
import { UploadButton } from '@/lib/uploadthing';
import { toSlug } from '@/lib/utils';
import { z } from 'zod';
import { useTranslations } from 'next-intl';

// Utility Functions
const getCurrentDateTime = () => {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
};

const logOperation = (operation: string, details?: any) => {
  const timestamp = getCurrentDateTime();
  console.log(`[${timestamp}] ${operation}`, {
    ...details,
    environment: process.env.NODE_ENV || 'development',
    userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server',
  });
};

// Zod Schemas
const DiscountSchema = z.object({
  type: z.enum(['none', 'percentage', 'fixed']),
  value: z.number().min(0).optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
});

const PricingSchema = z.object({
  basePrice: z.number().min(0),
  markup: z.number().min(0).max(100),
  profit: z.number().min(0),
  commission: z.number().min(0),
  finalPrice: z.number().min(0),
  discount: DiscountSchema,
});

const ColorStockSchema = z.object({
  name: z.string().min(1, 'Color name is required'),
  hex: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid hex color'),
  quantity: z.number().min(0),
  inStock: z.boolean(),
  sizes: z.array(
    z.object({
      name: z.string(),
      quantity: z.number().min(0),
      inStock: z.boolean(),
    })
  ),
});

const WarehouseSchema = z.object({
  warehouseId: z.string().min(1, 'Warehouse ID is required'),
  provider: z.enum(['ShipBob', '4PX']),
  sku: z.string().min(1, 'SKU is required'),
  quantity: z.number().min(0),
  location: z.string().min(1, 'Location is required'),
  minimumStock: z.number().min(0),
  reorderPoint: z.number().min(0),
  colors: z.array(ColorStockSchema),
  lastUpdated: z.date().optional(),
  updatedBy: z.string().optional(),
});

const ProductInputSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  slug: z.string().min(1, 'Slug is required'),
  category: z.string().min(1, 'Category is required'),
  images: z.array(z.string()).min(1, 'At least one image is required'),
  brand: z.string().min(1, 'Brand is required'),
  description: z.string().min(1, 'Description is required'),
  price: z.number().min(0, 'Price must be non-negative'),
  listPrice: z.number().min(0, 'List price is required'),
  countInStock: z.number().min(0, 'Stock must be non-negative'),
  sizes: z.array(z.string()).optional(),
  colors: z
    .array(
      z.object({
        name: z.string(),
        hex: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid hex color'),
        inStock: z.boolean(),
      })
    )
    .optional(),
  warehouseData: z.array(WarehouseSchema).min(1, 'At least one warehouse is required'),
  pricing: PricingSchema,
  status: z.enum(['draft', 'pending', 'published']),
  createdBy: z.string().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

const ProductUpdateSchema = ProductInputSchema.partial();

// Constants
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const PREDEFINED_COLORS = [
  { name: 'Black', hex: '#000000' },
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Red', hex: '#FF0000' },
  { name: 'Blue', hex: '#0000FF' },
  { name: 'Green', hex: '#00FF00' },
  { name: 'Yellow', hex: '#FFFF00' },
  { name: 'Gray', hex: '#808080' },
  { name: 'Purple', hex: '#800080' },
];

const DISCOUNT_TYPES = [
  { value: 'none', label: 'No Discount' },
  { value: 'percentage', label: 'Percentage (%)' },
  { value: 'fixed', label: 'Fixed Amount ($)' },
];

const MAX_IMAGES = 5;

// Pricing calculation helper
const calculatePricing = (
  basePrice: number,
  listPrice: number,
  markup: number,
  discount?: { type: 'percentage' | 'fixed' | 'none'; value: number }
) => {
  const commission = basePrice * 0.03; // 3% commission
  const suggestedPrice = basePrice * (1 + markup / 100);
  const suggestedMarkup =
    listPrice > basePrice ? ((listPrice - basePrice) / basePrice) * 100 : markup;

  let finalPrice = listPrice || suggestedPrice;

  if (discount && discount.type !== 'none' && discount.value > 0) {
    if (discount.type === 'percentage') {
      finalPrice *= 1 - discount.value / 100;
    } else {
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
  };
};

// Color Management Component
const ColorSection = ({ form }: { form: any }) => {
  const warehouseData = form.watch('warehouseData') || [];
  const selectedWarehouseIndex = 0; // Sellers only manage one warehouse
  const colors = warehouseData[selectedWarehouseIndex]?.colors || [];
  const t = useTranslations('Seller.ProductForm');

  const updateTotalStock = () => {
    const warehouseData = form.getValues('warehouseData');
    const totalQuantity =
      warehouseData[0]?.colors.reduce((total: number, color: any) => {
        const colorTotal = color.sizes.reduce((sum: number, size: any) => sum + size.quantity, 0);
        color.quantity = colorTotal;
        color.inStock = colorTotal > 0;
        return total + colorTotal;
      }, 0) || 0;

    form.setValue('warehouseData.0.quantity', totalQuantity);
    form.setValue('countInStock', totalQuantity);
    logOperation('Updated total stock', { totalQuantity });
  };

  return (
    <div className="space-y-4">
      <FormLabel>{t('colorsAndSizes')}</FormLabel>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {PREDEFINED_COLORS.map((color) => {
          const selectedColors = colors || [];
          const isChecked = selectedColors.some((c: any) => c.hex === color.hex);

          return (
            <div key={color.hex} className="flex items-center space-x-2">
              <Checkbox
                checked={isChecked}
                onCheckedChange={(checked) => {
                  let newColors = [...selectedColors];
                  if (checked) {
                    newColors.push({
                      name: color.name,
                      hex: color.hex,
                      quantity: 0,
                      inStock: true,
                      sizes: SIZES.map((size) => ({
                        name: size,
                        quantity: 0,
                        inStock: true,
                      })),
                    });
                  } else {
                    newColors = newColors.filter((c: any) => c.hex !== color.hex);
                  }
                  form.setValue(`warehouseData.0.colors`, newColors);
                  updateTotalStock();
                  logOperation('Colors updated', {
                    color: color.name,
                    action: checked ? 'added' : 'removed',
                  });
                }}
              />
              <label className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-full border"
                  style={{ backgroundColor: color.hex }}
                />
                {color.name}
              </label>
            </div>
          );
        })}
      </div>
      {colors.map((color: any, colorIndex: number) => (
        <Card key={colorIndex}>
          <CardContent className="pt-4 space-y-4">
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-full border"
                style={{ backgroundColor: color.hex }}
              />
              <span>{color.name}</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {color.sizes.map((size: any, sizeIndex: number) => (
                <FormField
                  key={size.name}
                  control={form.control}
                  name={`warehouseData.0.colors.${colorIndex}.sizes.${sizeIndex}.quantity`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{size.name}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          {...field}
                          value={field.value || 0}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 0;
                            field.onChange(value);
                            form.setValue(
                              `warehouseData.0.colors.${colorIndex}.sizes.${sizeIndex}.inStock`,
                              value > 0
                            );
                            updateTotalStock();
                            logOperation('Size quantity updated', {
                              color: color.name,
                              size: size.name,
                              quantity: value,
                            });
                          }}
                        />
                      </FormControl>
                      <FormDescription>
                        {t('inStock')}: {field.value > 0 ? t('yes') : t('no')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </div>
            <div className="text-sm text-muted-foreground">
              {t('totalQuantity')}: {color.quantity}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

interface ProductFormProps {
  type: 'Create' | 'Update';
  product?: z.infer<typeof ProductInputSchema>;
  productId?: string;
}

export default function ProductForm({ type, product, productId }: ProductFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { data: session } = useSession();
  const t = useTranslations('Seller.ProductForm');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [warehouses, setWarehouses] = useState<
    { id: string; name: string; location: string; provider: 'ShipBob' | '4PX' }[]
  >([]);
  const [images, setImages] = useState<string[]>(product?.images || []);

  // Fetch warehouses dynamically
  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const [shipBobRes, fourPXRes] = await Promise.all([
          fetch('/api/warehouses?provider=ShipBob', {
            headers: { 'x-api-key': process.env.NEXT_PUBLIC_API_KEY! },
          }),
          fetch('/api/warehouses?provider=4PX', {
            headers: { 'x-api-key': process.env.NEXT_PUBLIC_API_KEY! },
          }),
        ]);
        const shipBobData = await shipBobRes.json();
        const fourPxData = await fourPXRes.json();

        const shipBobWarehouses = shipBobData.success
          ? shipBobData.data.map((w: any) => ({ ...w, provider: 'ShipBob' as const }))
          : [];
        const fourPxWarehouses = fourPxData.success
          ? fourPxData.data.map((w: any) => ({ ...w, provider: '4PX' as const }))
          : [];

        setWarehouses([...shipBobWarehouses, ...fourPxWarehouses]);
        logOperation('Warehouses fetched', {
          shipBobCount: shipBobWarehouses.length,
          fourPxCount: fourPxWarehouses.length,
        });
      } catch (error) {
        console.error('Error fetching warehouses:', error);
        toast({
          variant: 'destructive',
          title: t('error'),
          description: t('warehouseFetchFailed'),
        });
      }
    };
    fetchWarehouses();
  }, [t, toast]);

  const form = useForm<z.infer<typeof ProductInputSchema>>({
    resolver: zodResolver(type === 'Update' ? ProductUpdateSchema : ProductInputSchema),
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
      sizes: [],
      colors: [],
      warehouseData: [
        {
          warehouseId: '',
          provider: 'ShipBob',
          sku: `SKU-${Date.now()}`,
          quantity: 0,
          location: '',
          minimumStock: 5,
          reorderPoint: 10,
          colors: [],
        },
      ],
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
    },
  });

  const formValues = form.watch();
  const basePrice = Number(formValues.price) || 0;
  const listPrice = Number(formValues.listPrice) || 0;
  const markup = Number(formValues.pricing?.markup) || 30;
  const discount = formValues.pricing?.discount;

  const pricing = useMemo(() => {
    return calculatePricing(basePrice, listPrice, markup, discount);
  }, [basePrice, listPrice, markup, discount]);

  async function onSubmit(values: z.infer<typeof ProductInputSchema>) {
    setIsSubmitting(true);
    const currentUser = session?.user?.id || 'unknown';

    logOperation('Form submission started', {
      user: currentUser,
      type,
      productId,
    });

    try {
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
          description: t('addAtLeastOneWarehouse'),
        });
        return;
      }

      const submissionData = {
        ...values,
        images,
        name: values.name.trim(),
        slug: values.slug.trim(),
        category: values.category.trim(),
        brand: values.brand.trim(),
        description: values.description.trim(),
        price: Number(values.price),
        listPrice: Number(values.listPrice) || Number(values.price),
        countInStock: Number(values.countInStock),
        sizes: values.sizes || [],
        colors: values.colors || [],
        warehouseData: values.warehouseData.map((wh) => ({
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
        },
        status: values.status || 'draft',
        createdBy: currentUser,
        updatedBy: currentUser,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      logOperation('Submitting product data', {
        product: submissionData.name,
        user: currentUser,
      });

      const res = await createProduct(submissionData);

      if (!res.success) {
        toast({
          variant: 'destructive',
          title: t('creationFailed'),
          description: res.message || t('unexpectedError'),
        });
        return;
      }

      // Sync with warehouse
      for (const wh of submissionData.warehouseData) {
        const syncResult = await syncWithWarehouse({
          productId: res.data._id,
          warehouseId: wh.warehouseId,
          provider: wh.provider,
          sku: wh.sku,
          quantity: wh.quantity,
          colors: wh.colors,
        });

        if (!syncResult.success) {
          toast({
            variant: 'destructive',
            title: t('warehouseSyncFailed'),
            description: syncResult.error || t('unexpectedError'),
          });
          return;
        }
      }

      toast({
        title: t('success'),
        description: t('productCreated'),
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
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Basic Information */}
        <div className="grid gap-6 md:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('productName')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('productNamePlaceholder')}
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      form.setValue('slug', toSlug(e.target.value));
                      logOperation('Product name changed', { value: e.target.value });
                    }}
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
                  >
                    {t('generate')}
                  </Button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Category and Brand */}
        <div className="grid gap-6 md:grid-cols-2">
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('category')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('categoryPlaceholder')}
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      logOperation('Category changed', { value: e.target.value });
                    }}
                  />
                </FormControl>
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
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Pricing */}
        <div className="grid gap-6 md:grid-cols-3">
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
                        logOperation('List price auto-updated', { value });
                      }
                    }}
                  />
                </FormControl>
                <FormDescription>
                  {t('yourCost')}: ${Number(field.value).toFixed(2)}
                  <br />
                  <small className="text-muted-foreground">
                    {t('commission')}: ${pricing.commission}
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
                        logOperation('Markup auto-updated', { suggestedMarkup });
                      }
                    }}
                  />
                </FormControl>
                <FormDescription>
                  {t('msrp')}: ${Number(field.value).toFixed(2)}
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
                    value={pricing.suggestedMarkup}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 30;
                      field.onChange(value);
                      logOperation('Markup changed', { value });
                    }}
                  />
                </FormControl>
                <FormDescription>
                  {t('finalPrice')}: ${pricing.finalPrice}
                  <br />
                  <small className="text-muted-foreground">
                    {t('estProfit')}: ${pricing.profit}
                  </small>
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Discount Section */}
        <div className="space-y-4">
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
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t('selectDiscountType')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {DISCOUNT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
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
                      />
                    </FormControl>
                    <FormDescription>
                      {form.watch('pricing.discount.type') === 'percentage'
                        ? t('enterPercentage')
                        : t('enterFixedAmount')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 md:grid-cols-2">
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
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </>
          )}
        </div>

        {/* Description */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('description')}</FormLabel>
              <FormControl>
                <Textarea
                  placeholder={t('descriptionPlaceholder')}
                  className="min-h-[100px]"
                  {...field}
                  onChange={(e) => {
                    field.onChange(e);
                    logOperation('Description updated', { length: e.target.value.length });
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Images */}
        <div className="space-y-4">
          <FormLabel>{t('productImages')}</FormLabel>
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
                    onClick={() => {
                      if (confirm(t('confirmDeleteImage'))) {
                        setImages(images.filter((_, i) => i !== index));
                        logOperation('Image removed', { imageIndex: index, image });
                      }
                    }}
                  >
                    ×
                  </Button>
                </CardContent>
              </Card>
            ))}
            {images.length < MAX_IMAGES && (
              <Card className="w-[150px] h-[150px] flex items-center justify-center">
                <CardContent className="p-0">
                  <UploadButton
                    endpoint="imageUploader"
                    onClientUploadComplete={(res) => {
                      if (res && res.length) {
                        const newImages = res.map((file) => file.url || file.ufsUrl || '');
                        if (images.length + newImages.length > MAX_IMAGES) {
                          toast({
                            variant: 'destructive',
                            title: t('tooManyImages'),
                            description: t('maxImages', { max: MAX_IMAGES }),
                          });
                          return;
                        }
                        setImages([...images, ...newImages]);
                        logOperation('Images uploaded', { urls: newImages });
                        toast({
                          description: t('imagesUploaded', { count: newImages.length }),
                        });
                      }
                    }}
                    onUploadError={(error: Error) => {
                      logOperation('Image upload error', { error: error.message });
                      toast({
                        variant: 'destructive',
                        description: error.message,
                      });
                    }}
                  />
                </CardContent>
              </Card>
            )}
          </div>
          <FormDescription>{t('imageRequirements')}</FormDescription>
          <FormMessage />
        </div>

        {/* Warehouse */}
        <div className="space-y-4">
          <FormLabel>{t('warehouse')}</FormLabel>
          <div className="grid gap-6 md:grid-cols-2">
            <FormField
              control={form.control}
              name="warehouseData.0.warehouseId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('selectWarehouse')}</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value);
                      const selectedWarehouse = warehouses.find((w) => w.id === value);
                      if (selectedWarehouse) {
                        form.setValue('warehouseData.0.location', selectedWarehouse.location);
                        form.setValue('warehouseData.0.provider', selectedWarehouse.provider);
                      }
                      logOperation('Warehouse changed', { value });
                    }}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('selectWarehouse')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {warehouses.map((warehouse) => (
                        <SelectItem key={warehouse.id} value={warehouse.id}>
                          {warehouse.name} ({warehouse.provider} - {warehouse.location})
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
              name="warehouseData.0.sku"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('sku')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('skuPlaceholder')}
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        logOperation('SKU changed', { value: e.target.value });
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="warehouseData.0.location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('location')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('locationPlaceholder')}
                    {...field}
                    readOnly
                    onChange={(e) => {
                      field.onChange(e);
                      logOperation('Location changed', { value: e.target.value });
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="warehouseData.0.minimumStock"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('minimumStock')}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="0"
                    {...field}
                    value={field.value || 5}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 5;
                      field.onChange(value);
                      logOperation('Minimum stock changed', { value });
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="warehouseData.0.reorderPoint"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('reorderPoint')}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="0"
                    {...field}
                    value={field.value || 10}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 10;
                      field.onChange(value);
                      logOperation('Reorder point changed', { value });
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Colors and Sizes */}
        <ColorSection form={form} />

        {/* Sizes */}
        <FormField
          control={form.control}
          name="sizes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('availableSizes')}</FormLabel>
              <FormControl>
                <Input
                  placeholder={t('sizesPlaceholder')}
                  {...field}
                  value={field.value?.join(',') || ''}
                  onChange={(e) => {
                    const sizes = e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean);
                    field.onChange(sizes);
                    logOperation('Sizes updated', { sizes });
                  }}
                />
              </FormControl>
              <FormDescription>{t('sizesDescription')}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Status */}
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
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectStatus')} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="draft">{t('draft')}</SelectItem>
                  <SelectItem value="pending">{t('pending')}</SelectItem>
                  <SelectItem value="published">{t('published')}</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Submit Button */}
        <Button
          type="submit"
          disabled={isSubmitting || warehouses.length === 0}
          className="w-full"
        >
          {isSubmitting
            ? t('submitting')
            : type === 'Create'
            ? t('createProduct')
            : t('updateProduct')}
        </Button>
      </form>
    </Form>
  );
}