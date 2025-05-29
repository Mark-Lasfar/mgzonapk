'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useForm, useFormContext } from 'react-hook-form'
import { useSession } from 'next-auth/react'
import { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import { createProduct, updateProduct } from '@/lib/actions/product.actions'
import { syncProductInventory } from '@/lib/actions/warehouse.actions'
import { UploadButton } from '@/lib/uploadthing'
import { toSlug } from '@/lib/utils'
import { z } from 'zod'
import { useTranslations } from 'next-intl'

// Utility Functions
const logOperation = (operation: string, details?: any) => {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] ${operation}`, {
    ...details,
    environment: process.env.NODE_ENV || 'development',
  })
}

// Zod Schemas
const DiscountSchema = z.object({
  type: z.enum(['none', 'percentage', 'fixed']),
  value: z.number().min(0).optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
})

const PricingSchema = z.object({
  basePrice: z.number().min(0),
  markup: z.number().min(0).max(100),
  profit: z.number().min(0),
  commission: z.number().min(0),
  finalPrice: z.number().min(0),
  discount: DiscountSchema,
})

const SizeSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().min(0),
  inStock: z.boolean(),
})

const ColorSchema = z.object({
  name: z.string().min(1, 'Color name is required'),
  hex: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid hex color'),
  quantity: z.number().min(0),
  inStock: z.boolean(),
  sizes: z.array(SizeSchema),
})

const WarehouseSchema = z.object({
  warehouseId: z.string().min(1, 'Warehouse ID is required'),
  provider: z.enum(['ShipBob', '4PX']),
  sku: z.string().min(1, 'SKU is required'),
  quantity: z.number().min(0),
  location: z.string().min(1, 'Location is required'),
  minimumStock: z.number().min(0),
  reorderPoint: z.number().min(0),
  colors: z.array(ColorSchema),
  lastUpdated: z.date().optional(),
  updatedBy: z.string().optional(),
})

const ProductInputSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  slug: z.string().min(1, 'Slug is required'),
  category: z.string().min(1, 'Category is required'),
  images: z.array(z.string()).min(1, 'At least one image is required'),
  brand: z.string().min(1, 'Brand is required'),
  description: z.string().min(1, 'Description is required'),
  price: z.number().min(0, 'Price must be non-negative'),
  listPrice: z.number().min(0, 'List price must be non-negative'),
  countInStock: z.number().min(0, 'Stock must be non-negative'),
  isPublished: z.boolean(),
  tags: z.array(z.string()).optional(),
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
  warehouse: z
    .object({
      provider: z.enum(['ShipBob', '4PX']),
      sku: z.string().min(1),
      quantity: z.number().min(0),
      location: z.string().min(1),
      minimumStock: z.number().min(0),
      reorderPoint: z.number().min(0),
    })
    .optional(),
  pricing: PricingSchema,
  status: z.enum(['draft', 'pending', 'published']),
  createdBy: z.string().optional(),
  updatedBy: z.string().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
})

const ProductUpdateSchema = ProductInputSchema.partial()

// Constants
const MAX_IMAGES = 5
const PREDEFINED_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
const PREDEFINED_COLORS = [
  { name: 'Black', hex: '#000000' },
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Red', hex: '#FF0000' },
  { name: 'Blue', hex: '#0000FF' },
  { name: 'Green', hex: '#00FF00' },
  { name: 'Yellow', hex: '#FFFF00' },
]

// Fetch Warehouses
const fetchWarehouses = async () => {
  try {
    const [shipBobRes, fourPXRes] = await Promise.all([
      fetch('/api/warehouses?provider=ShipBob', {
        headers: { 'x-api-key': process.env.NEXT_PUBLIC_API_KEY || '' },
      }),
      fetch('/api/warehouses?provider=4PX', {
        headers: { 'x-api-key': process.env.NEXT_PUBLIC_API_KEY || '' },
      }),
    ])
    const shipBobData = await shipBobRes.json()
    const fourPxData = await fourPXRes.json()

    const shipBobWarehouses = shipBobData.success
      ? shipBobData.data.map((w: any) => ({ ...w, provider: 'ShipBob' as const }))
      : []
    const fourPxWarehouses = fourPxData.success
      ? fourPxData.data.map((w: any) => ({ ...w, provider: '4PX' as const }))
      : []

    return [...shipBobWarehouses, ...fourPxWarehouses]
  } catch (error) {
    logOperation('Warehouse fetch error', { error })
    return []
  }
}

// Fetch Product Options
const fetchProductOptions = async () => {
  try {
    const res = await fetch('/api/product-options')
    const data = await res.json()
    return {
      tags: data.tags || [],
      sizes: data.sizes || PREDEFINED_SIZES,
      colors: data.colors || PREDEFINED_COLORS,
    }
  } catch (error) {
    logOperation('Product options fetch error', { error })
    return { tags: [], sizes: PREDEFINED_SIZES, colors: PREDEFINED_COLORS }
  }
}

// Pricing Calculation
const calculatePricing = (
  basePrice: number,
  listPrice: number,
  markup: number,
  discount?: { type: 'percentage' | 'fixed' | 'none'; value: number }
) => {
  const commission = basePrice * 0.03 // 3% commission
  const suggestedPrice = basePrice * (1 + markup / 100)
  const suggestedMarkup =
    listPrice > basePrice ? ((listPrice - basePrice) / basePrice) * 100 : markup

  let finalPrice = listPrice || suggestedPrice
  if (discount && discount.type !== 'none' && discount.value > 0) {
    if (discount.type === 'percentage') {
      finalPrice *= 1 - discount.value / 100
    } else {
      finalPrice -= discount.value
    }
  }

  finalPrice = Math.max(finalPrice, basePrice)
  const profit = finalPrice - basePrice - commission

  return {
    finalPrice: Number(finalPrice.toFixed(2)),
    profit: Number(profit.toFixed(2)),
    commission: Number(commission.toFixed(2)),
    suggestedMarkup: Number(suggestedMarkup.toFixed(1)),
  }
}

// Color Manager Component
const ColorManager = ({ warehouseIndex }: { warehouseIndex: number }) => {
  const { setValue, watch } = useFormContext()
  const t = useTranslations('Admin.ProductForm')
  const colors = watch(`warehouseData.${warehouseIndex}.colors`) || []
  const { data: productOptions } = useQuery({
    queryKey: ['product-options'],
    queryFn: fetchProductOptions,
  })

  const updateTotalStock = useCallback(() => {
    const warehouseData = watch('warehouseData')
    const totalQuantity = warehouseData.reduce((total: number, wh: any, idx: number) => {
      const whTotal = wh.colors.reduce((whSum: number, color: any, colorIdx: number) => {
        const colorTotal = color.sizes.reduce((sum: number, size: any) => sum + (size.quantity || 0), 0)
        setValue(`warehouseData.${idx}.colors.${colorIdx}.quantity`, colorTotal)
        setValue(`warehouseData.${idx}.colors.${colorIdx}.inStock`, colorTotal > 0)
        return whSum + colorTotal
      }, 0)
      setValue(`warehouseData.${idx}.quantity`, whTotal)
      return total + whTotal
    }, 0)
    setValue('countInStock', totalQuantity)
    logOperation('Total stock updated', { totalQuantity, warehouseIndex })
  }, [setValue, watch, warehouseIndex])

  const addColor = useCallback(
    (color: { name: string; hex: string }) => {
      const newColors = [
        ...colors,
        {
          name: color.name,
          hex: color.hex,
          quantity: 0,
          inStock: true,
          sizes: (productOptions?.sizes || PREDEFINED_SIZES).map((size: string) => ({
            name: size,
            quantity: 0,
            inStock: true,
          })),
        },
      ]
      setValue(`warehouseData.${warehouseIndex}.colors`, newColors)
      updateTotalStock()
      logOperation('Color added', { color: color.name, warehouseIndex })
    },
    [colors, productOptions, setValue, warehouseIndex, updateTotalStock]
  )

  return (
    <div className="space-y-4">
      <FormLabel>{t('colorsAndSizes')}</FormLabel>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(productOptions?.colors || PREDEFINED_COLORS).map((color: { name: string; hex: string }) => {
          const isChecked = colors.some((c: any) => c.hex === color.hex)
          return (
            <div key={color.hex} className="flex items-center space-x-2">
              <Checkbox
                checked={isChecked}
                onCheckedChange={(checked) => {
                  if (checked) {
                    addColor(color)
                  } else {
                    const newColors = colors.filter((c: any) => c.hex !== color.hex)
                    setValue(`warehouseData.${warehouseIndex}.colors`, newColors)
                    updateTotalStock()
                    logOperation('Color removed', { color: color.name, warehouseIndex })
                  }
                }}
              />
              <label className="flex items-center gap-2">
                <span
                  className="w-4 h-4 rounded-full border"
                  style={{ backgroundColor: color.hex }}
                />
                {color.name}
              </label>
            </div>
          )
        })}
      </div>
      {colors.map((color: any, index: number) => (
        <Card key={index}>
          <CardContent className="pt-4 space-y-4">
            <div className="flex items-center gap-2">
              <Input
                value={color.name}
                onChange={(e) => {
                  setValue(`warehouseData.${warehouseIndex}.colors.${index}.name`, e.target.value)
                  logOperation('Color name updated', { name: e.target.value, warehouseIndex })
                }}
              />
              <Input
                type="color"
                value={color.hex}
                onChange={(e) => {
                  setValue(`warehouseData.${warehouseIndex}.colors.${index}.hex`, e.target.value)
                  logOperation('Color hex updated', { hex: e.target.value, warehouseIndex })
                }}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              {color.sizes.map((size: any, sizeIndex: number) => (
                <FormField
                  key={size.name}
                  control={useFormContext().control}
                  name={`warehouseData.${warehouseIndex}.colors.${index}.sizes.${sizeIndex}.quantity`}
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
                            const value = parseInt(e.target.value) || 0
                            field.onChange(value)
                            setValue(
                              `warehouseData.${warehouseIndex}.colors.${index}.sizes.${sizeIndex}.inStock`,
                              value > 0
                            )
                            updateTotalStock()
                            logOperation('Size quantity updated', {
                              color: color.name,
                              size: size.name,
                              quantity: value,
                              warehouseIndex,
                            })
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
  )
}

// Warehouse Form Component
const WarehouseForm = ({ index, onRemove }: { index: number; onRemove: () => void }) => {
  const { control, setValue, watch } = useFormContext()
  const t = useTranslations('Admin.ProductForm')
  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: fetchWarehouses,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between">
          {t('warehouse')} #{index + 1}
          {index > 0 && (
            <Button variant="destructive" onClick={onRemove}>
              {t('remove')}
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={control}
            name={`warehouseData.${index}.warehouseId`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('warehouse')}</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={(value) => {
                    field.onChange(value)
                    const selectedWarehouse = warehouses.find((w: any) => w.id === value)
                    if (selectedWarehouse) {
                      setValue(`warehouseData.${index}.location`, selectedWarehouse.location)
                      setValue(`warehouseData.${index}.provider`, selectedWarehouse.provider)
                    }
                    logOperation('Warehouse changed', { value, index })
                  }}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t('selectWarehouse')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {warehouses.map((warehouse: any) => (
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
            control={control}
            name={`warehouseData.${index}.sku`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('sku')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('skuPlaceholder')}
                    {...field}
                    onChange={(e) => {
                      field.onChange(e.target.value)
                      logOperation('SKU changed', { value: e.target.value, index })
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={control}
          name={`warehouseData.${index}.location`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('location')}</FormLabel>
              <FormControl>
                <Input
                  placeholder={t('locationPlaceholder')}
                  {...field}
                  readOnly
                  onChange={(e) => {
                    field.onChange(e.target.value)
                    logOperation('Location changed', { value: e.target.value, index })
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`warehouseData.${index}.minimumStock`}
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
                    const value = parseInt(e.target.value) || 5
                    field.onChange(value)
                    logOperation('Minimum stock changed', { value, index })
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`warehouseData.${index}.reorderPoint`}
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
                    const value = parseInt(e.target.value) || 10
                    field.onChange(value)
                    logOperation('Reorder point changed', { value, index })
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <ColorManager warehouseIndex={index} />
      </CardContent>
    </Card>
  )
}

// Product Preview Component
const ProductPreview = ({ formValues }: { formValues: any }) => {
  const t = useTranslations('Admin.ProductForm')
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('preview')}</CardTitle>
      </CardHeader>
      <CardContent>
        <h3>{formValues.name || t('productName')}</h3>
        <Image
          src={formValues.images?.[0] || '/placeholder.png'}
          alt={t('productImage')}
          width={150}
          height={150}
          className="object-cover rounded-lg"
        />
        <p>{t('price')}: ${formValues.pricing?.finalPrice || 0}</p>
        <p>{t('stock')}: {formValues.countInStock || 0}</p>
        <p>{t('status')}: {formValues.status || 'draft'}</p>
      </CardContent>
    </Card>
  )
}

interface ProductFormProps {
  type: 'Create' | 'Update'
  product?: z.infer<typeof ProductInputSchema>
  productId?: string
}

export default function ProductForm({ type, product, productId }: ProductFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const { data: session } = useSession()
  const t = useTranslations('Admin.ProductForm')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [warehouseCount, setWarehouseCount] = useState(product?.warehouseData?.length || 1)

  const { data: productOptions } = useQuery({
    queryKey: ['product-options'],
    queryFn: fetchProductOptions,
  })

  const form = useForm<z.infer<typeof ProductInputSchema>>({
    resolver: zodResolver(type === 'Update' ? ProductUpdateSchema : ProductInputSchema),
    defaultValues: product && type === 'Update'
      ? product
      : {
          name: '',
          slug: '',
          category: '',
          images: [],
          brand: '',
          description: '',
          price: 0,
          listPrice: 0,
          countInStock: 0,
          isPublished: false,
          tags: ['new-arrival'],
          sizes: [],
          colors: [],
          warehouseData: Array.from({ length: warehouseCount }, (_, i) => ({
            warehouseId: '',
            provider: 'ShipBob' as 'ShipBob',
            sku: `SKU-${Date.now() + i}`,
            quantity: 0,
            location: '',
            minimumStock: 5,
            reorderPoint: 10,
            colors: [],
          })),
          warehouse: {
            provider: 'ShipBob',
            sku: `SKU-${Date.now()}`,
            quantity: 0,
            location: '',
            minimumStock: 0,
            reorderPoint: 0,
          },
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
          updatedBy: session?.user?.id,
        },
  })

  const formValues = form.watch()
  const basePrice = Number(formValues.price) || 0
  const listPrice = Number(formValues.listPrice) || 0
  const markup = Number(formValues.pricing?.markup) || 30
  const discount = formValues.pricing?.discount

  const pricing = useMemo(() => {
    return calculatePricing(basePrice, listPrice, markup, discount)
  }, [basePrice, listPrice, markup, discount])

  const addWarehouse = useCallback(() => {
    const currentWarehouses = form.getValues('warehouseData') || []
    form.setValue('warehouseData', [
      ...currentWarehouses,
      {
        warehouseId: '',
        provider: 'ShipBob' as 'ShipBob',
        sku: `SKU-${Date.now() + currentWarehouses.length}`,
        quantity: 0,
        location: '',
        minimumStock: 5,
        reorderPoint: 10,
        colors: [],
      },
    ])
    setWarehouseCount((prev) => prev + 1)
    logOperation('Warehouse added', { count: warehouseCount + 1 })
  }, [form, warehouseCount])

  const removeWarehouse = useCallback(
    (index: number) => {
      const currentWarehouses = form.getValues('warehouseData') || []
      const newWarehouses = currentWarehouses.filter((_, i: number) => i !== index)
      form.setValue('warehouseData', newWarehouses)
      setWarehouseCount((prev) => prev - 1)
      logOperation('Warehouse removed', { index })
    },
    [form]
  )

  async function onSubmit(values: z.infer<typeof ProductInputSchema>) {
    setIsSubmitting(true)
    const currentUser = session?.user?.id || 'unknown'

    logOperation('Form submission started', {
      user: currentUser,
      type,
      productId,
    })

    try {
      if (!values.images?.length) {
        toast({
          variant: 'destructive',
          title: t('submissionError'),
          description: t('addAtLeastOneImage'),
        })
        return
      }

      if (!values.warehouseData?.length) {
        toast({
          variant: 'destructive',
          title: t('submissionError'),
          description: t('addAtLeastOneWarehouse'),
        })
        return
      }

      const submissionData = {
        ...values,
        name: values.name.trim(),
        slug: values.slug.trim(),
        category: values.category.trim(),
        brand: values.brand.trim(),
        description: values.description.trim(),
        price: Number(values.price),
        listPrice: Number(values.listPrice) || Number(values.price),
        countInStock: Number(values.countInStock),
        isPublished: values.isPublished || false,
        tags: values.tags || [],
        sizes: values.sizes || [],
        colors: values.colors || [],
        warehouseData: values.warehouseData.map((wh) => ({
          ...wh,
          lastUpdated: new Date(),
          updatedBy: currentUser,
        })),
        warehouse: {
          provider: values.warehouseData[0].provider,
          sku: values.warehouseData[0].sku,
          quantity: values.warehouseData[0].quantity,
          location: values.warehouseData[0].location,
          minimumStock: values.warehouseData[0].minimumStock || 5,
          reorderPoint: values.warehouseData[0].reorderPoint || 10,
        },
        pricing: {
          basePrice: Number(values.price),
          markup: Number(pricing.suggestedMarkup || values.pricing?.markup || 30),
          finalPrice: pricing.finalPrice,
          profit: pricing.profit,
          commission: pricing.commission,
          discount: {
            type: values.pricing?.discount?.type || 'none',
            value: Number(values.pricing?.discount?.value || 0),
            startDate: values.pricing?.discount?.startDate,
            endDate: values.pricing?.discount?.endDate,
          },
        },
        status: values.status || 'draft',
        createdBy: currentUser,
        updatedBy: currentUser,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      let res
      if (type === 'Create') {
        res = await createProduct(submissionData)
      } else {
        res = await updateProduct(productId!, submissionData)
      }

      if (!res.success) {
        toast({
          variant: 'destructive',
          title: t('creationFailed'),
          description: res.message || t('unexpectedError'),
        })
        return
      }

      // Sync with warehouse
      const syncResult = await syncProductInventory(res.data._id)
      if (!syncResult.success) {
        toast({
          variant: 'destructive',
          title: t('warehouseSyncFailed'),
          description: syncResult.message || t('unexpectedError'),
        })
        return
      }

      toast({
        title: t('success'),
        description: type === 'Create' ? t('productCreated') : t('productUpdated'),
      })

      router.push('/admin/products')
      router.refresh()
    } catch (error) {
      logOperation('Form submission error', { error })
      toast({
        variant: 'destructive',
        title: t('error'),
        description: error instanceof Error ? error.message : t('unexpectedError'),
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>{t('basicInfo')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('productName')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('enterProductName')}
                          {...field}
                          onChange={(e) => {
                            field.onChange(e.target.value)
                            form.setValue('slug', toSlug(e.target.value))
                            logOperation('Product name changed', { value: e.target.value })
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
                            placeholder={t('enterSlug')}
                            {...field}
                            onChange={(e) => {
                              field.onChange(e.target.value)
                              logOperation('Slug changed', { value: e.target.value })
                            }}
                          />
                        </FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            const newSlug = toSlug(form.getValues('name'))
                            form.setValue('slug', newSlug)
                            logOperation('Slug generated', { value: newSlug })
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
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('category')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('enterCategory')}
                          {...field}
                          onChange={(e) => {
                            field.onChange(e.target.value)
                            logOperation('Category changed', { value: e.target.value })
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
                          placeholder={t('enterBrand')}
                          {...field}
                          onChange={(e) => {
                            field.onChange(e.target.value)
                            logOperation('Brand changed', { value: e.target.value })
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t('pricing')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
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
                          value={field.value || 0}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0
                            field.onChange(value)
                            logOperation('Base price changed', { value })
                            const currentListPrice = form.getValues('listPrice')
                            if (!currentListPrice || currentListPrice < value) {
                              form.setValue('listPrice', value)
                              logOperation('List price auto-updated', { value })
                            }
                          }}
                        />
                      </FormControl>
                      <FormDescription>
                        {t('yourCost')}: ${Number(field.value || 0).toFixed(2)}
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
                          value={field.value || 0}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0
                            field.onChange(value)
                            logOperation('List price changed', { value })
                            const basePrice = form.getValues('price')
                            if (basePrice && value > basePrice) {
                              const suggestedMarkup = ((value - basePrice) / basePrice) * 100
                              form.setValue('pricing.markup', suggestedMarkup)
                              logOperation('Markup auto-updated', { suggestedMarkup })
                            }
                          }}
                        />
                      </FormControl>
                      <FormDescription>
                        {t('msrp')}: ${Number(field.value || 0).toFixed(2)}
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
                          value={Number(field.value || pricing.suggestedMarkup).toFixed(1)}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 30
                            field.onChange(value)
                            logOperation('Markup changed', { value })
                          }}
                        />
                      </FormControl>
                      <FormDescription>
                        {t('finalPrice')}: ${pricing.finalPrice}
                        <br />
                        <small className="text-muted-foreground">
                          {t('estimatedProfit')}: ${pricing.profit}
                        </small>
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="pricing.discount.type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('discountType')}</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value)
                        logOperation('Discount type changed', { value })
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('selectDiscountType')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {['none', 'percentage', 'fixed'].map((type) => (
                          <SelectItem key={type} value={type}>
                            {t(`discount_${type}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {form.watch('pricing.discount.type') !== 'none' && (
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="pricing.discount.value"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('discountValue')}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            step={form.watch('pricing.discount.type') === 'percentage' ? '1' : '0.01'}
                            max={form.watch('pricing.discount.type') === 'percentage' ? '100' : undefined}
                            {...field}
                            value={field.value || 0}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value) || 0
                              field.onChange(value)
                              logOperation('Discount value changed', { value })
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
                                field.onChange(e.target.value ? new Date(e.target.value) : undefined)
                                logOperation('Discount start date changed', { value: e.target.value })
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
                                field.onChange(e.target.value ? new Date(e.target.value) : undefined)
                                logOperation('Discount end date changed', { value: e.target.value })
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t('description')}</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('description')}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t('enterDescription')}
                        className="min-h-[100px]"
                        {...field}
                        value={field.value || ''}
                        onChange={(e) => {
                          field.onChange(e.target.value)
                          logOperation('Description changed', { length: e.target.value.length })
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t('productImages')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                {formValues.images?.map((image: string, index: number) => (
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
                            const newImages = formValues.images.filter((_: string, i: number) => i !== index)
                            form.setValue('images', newImages)
                            logOperation('Image deleted', { index, image })
                          }
                        }}
                      >
                        ×
                      </Button>
                    </CardContent>
                  </Card>
                ))}
                {formValues.images?.length < MAX_IMAGES && (
                  <Card className="w-[150px] h-[150px] flex items-center justify-center">
                    <CardContent className="p-0">
                      <UploadButton
                        endpoint="imageUploader"
                        onClientUploadComplete={(res) => {
                          if (res && res.length) {
                            const newImages = res.map((file) => file.url || '')
                            const currentImages = form.getValues('images') || []
                            if (currentImages.length + newImages.length > MAX_IMAGES) {
                              toast({
                                variant: 'destructive',
                                title: t('tooManyImages'),
                                description: t('maxImages', { maxImages: MAX_IMAGES }),
                              })
                              return
                            }
                            form.setValue('images', [...currentImages, ...newImages])
                            logOperation('Images uploaded', { urls: newImages })
                            toast({
                              title: t('success'),
                              description: t('imagesUploaded', { count: newImages.length }),
                            })
                          }
                        }}
                        onUploadError={(error: Error) => {
                          logOperation('Image upload error', { error: error.message })
                          toast({
                            variant: 'destructive',
                            title: t('uploadFailed'),
                            description: error.message,
                          })
                        }}
                      />
                    </CardContent>
                  </Card>
                )}
              </div>
              <FormDescription>{t('imageRequirements', { maxImages: MAX_IMAGES })}</FormDescription>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t('warehouses')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Button type="button" variant="outline" onClick={addWarehouse}>
                {t('addWarehouse')}
              </Button>
              {formValues.warehouseData?.map((_: any, index: number) => (
                <WarehouseForm key={index} index={index} onRemove={() => removeWarehouse(index)} />
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t('tagsAndSizes')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="tags"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('tags')}</FormLabel>
                      <div className="grid grid-cols-2 gap-2">
                        {(productOptions?.tags || []).map((tag: { value: string; label: string }) => (
                          <div key={tag.value} className="flex items-center space-x-2">
                            <Checkbox
                              checked={field.value?.includes(tag.value)}
                              onCheckedChange={(checked: boolean) => {
                                const newTags = checked
                                  ? [...(field.value || []), tag.value]
                                  : field.value?.filter((t: string) => t !== tag.value)
                                field.onChange(newTags)
                                logOperation('Tags changed', { newTags })
                              }}
                            />
                            <label>{tag.label}</label>
                          </div>
                        ))}
                      </div>
                      <FormDescription>{t('tagsDescription')}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                          value={field.value?.join(', ') || ''}
                          onChange={(e) => {
                            const sizes = e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean)
                            field.onChange(sizes)
                            logOperation('Sizes changed', { sizes })
                          }}
                        />
                      </FormControl>
                      <FormDescription>{t('sizesDescription')}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>
          <Card>
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
                        field.onChange(value)
                        logOperation('Status changed', { value })
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
                    <FormDescription>{t('statusDescription')}</FormDescription>
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
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(checked: boolean) => {
                          field.onChange(checked)
                          logOperation('Publish status changed', { checked })
                        }}
                      />
                    </FormControl>
                    <FormLabel>{t('publish')}</FormLabel>
                    <FormDescription>{t('publishDescription')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full"
          >
            {isSubmitting
              ? t('processing')
              : type === 'Create'
                ? t('createProduct')
                : t('updateProduct')}
          </Button>
        </form>
      </Form>
      <ProductPreview formValues={formValues} />
    </div>
  )
}