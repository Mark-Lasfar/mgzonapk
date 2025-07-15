'use client'

import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
// import { useToast } from '@/hooks/use-toast'
import { formatCurrency } from '@/lib/utils'
// import { syncProductInventory } from '@/lib/actions/warehouse.actions'
import Link from 'next/link'
import { useState } from 'react'
import { useToast } from '@/components/ui/toast'
import { syncProductInventory } from '@/lib/actions/product.actions'

interface Warehouse {
  provider: string
  location: string
  availableQuantity: number
  lastSync?: string
}

interface Product {
  _id: string
  name: string
  price: number
  warehouse: Warehouse
}

interface ProductListProps {
  products?: Product[]
  isLoading?: boolean
}

export default function ProductList({ products = [], isLoading = false }: ProductListProps) {
  const { toast } = useToast()
  const [syncingProducts, setSyncingProducts] = useState<string[]>([])

  const handleSync = async (productId: string) => {
    setSyncingProducts((prev) => [...prev, productId])
    
    try {
      const response = await syncProductInventory(productId)
      if (!response.success) throw new Error(response.error)
      
      toast({
        title: 'Success',
        description: 'Product inventory synced successfully',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to sync product',
        variant: 'destructive',
      })
    } finally {
      setSyncingProducts((prev) => prev.filter(id => id !== productId))
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-32 bg-muted animate-pulse rounded" />
        <div className="rounded-md border">
          <div className="h-[400px] flex items-center justify-center">
            <p className="text-muted-foreground">Loading products...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <Button asChild>
          <Link href="/seller/dashboard/products/create">Add Product</Link>
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Warehouse</TableHead>
              <TableHead>Last Sync</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products?.length > 0 ? (
              products.map((product) => (
                <TableRow key={product._id}>
                  <TableCell>{product.name}</TableCell>
                  <TableCell>{formatCurrency(product.price)}</TableCell>
                  <TableCell>{product.warehouse.availableQuantity}</TableCell>
                  <TableCell>
                    {product.warehouse.provider} - {product.warehouse.location}
                  </TableCell>
                  <TableCell>
                    {product.warehouse.lastSync
                      ? new Date(product.warehouse.lastSync).toLocaleString()
                      : 'Never'}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={syncingProducts.includes(product._id)}
                        onClick={() => handleSync(product._id)}
                      >
                        {syncingProducts.includes(product._id) ? 'Syncing...' : 'Sync'}
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/seller/dashboard/products/${product._id}`}>
                          Edit
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  No products found. Add your first product to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}