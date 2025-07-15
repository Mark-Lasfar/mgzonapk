'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import { createWarehouse, updateWarehouse } from '@/lib/actions/warehouse.actions'

// Zod validation schema
const warehouseSchema = z.object({
  name: z.string().min(1, 'Warehouse name is required').max(100, 'Name is too long'),
  code: z.string().min(1, 'Warehouse code is required').max(50, 'Code is too long'),
  provider: z.enum(['ShipBob', '4PX'], { required_error: 'Provider is required' }),
  apiKey: z.string().min(1, 'API Key is required').regex(/^[a-zA-Z0-9_-]+$/, 'Invalid API Key format'),
  apiUrl: z.string().url('Invalid API URL').min(1, 'API URL is required'),
  location: z.string().min(1, 'Location is required').max(200, 'Location is too long'),
  isActive: z.boolean(),
  settings: z.object({
    autoSync: z.boolean(),
    syncInterval: z.number().min(600000, 'Sync interval must be at least 10 minutes'),
    inventorySync: z.boolean().optional(),
    orderSync: z.boolean().optional(),
  }),
})

interface IWarehouse {
  _id: string
  name: string
  code: string
  provider: 'ShipBob' | '4PX'
  apiKey: string
  apiUrl: string
  location: string
  isActive: boolean
  settings: {
    autoSync: boolean
    syncInterval: number
    inventorySync?: boolean
    orderSync?: boolean
  }
}

interface IWarehouseInput extends Omit<IWarehouse, '_id'> {}

interface WarehouseDialogProps {
  warehouse?: IWarehouse | null
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function WarehouseDialog({ warehouse, open, onClose, onSuccess }: WarehouseDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const form = useForm<IWarehouseInput>({
    resolver: zodResolver(warehouseSchema),
    defaultValues: warehouse || {
      name: '',
      code: '',
      provider: 'ShipBob',
      apiKey: '',
      apiUrl: 'https://api.shipbob.com',
      location: '',
      isActive: true,
      settings: {
        autoSync: true,
        syncInterval: 3600000,
        inventorySync: true,
        orderSync: true,
      },
    },
  })

  async function onSubmit(data: IWarehouseInput) {
    setLoading(true);
  
    try {
      const res = warehouse
        ? await updateWarehouse(warehouse._id, data) // تمرير id و params بشكل صحيح
        : await createWarehouse(data);
  
      if (res.success) {
        toast({
          title: 'Success',
          description: res.message,
        });
        form.reset();
        onSuccess();
        onClose();
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: res.message || 'Something went wrong.',
        });
      }
    } catch (error) {
      console.error('Warehouse submission error:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save warehouse. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  }
  
  

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <div className="p-6">
        <h2 className="text-lg font-semibold mb-4">
          {warehouse ? 'Edit' : 'Add'} Warehouse
        </h2>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Warehouse Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., Main Warehouse" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Code */}
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Warehouse Code</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., WH001" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Provider */}
            <FormField
              control={form.control}
              name="provider"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Provider</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select provider" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="ShipBob">ShipBob</SelectItem>
                      <SelectItem value="4PX">4PX</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* API Key */}
            <FormField
              control={form.control}
              name="apiKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API Key</FormLabel>
                  <FormControl>
                    <Input {...field} type="password" placeholder="Enter API Key" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* API URL */}
            <FormField
              control={form.control}
              name="apiUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API URL</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., https://api.shipbob.com" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Location */}
            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., Chicago, IL" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Active */}
            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 border p-4">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-1">
                    <FormLabel>Active</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Enable this warehouse to process orders
                    </p>
                  </div>
                </FormItem>
              )}
            />

            {/* Auto Sync */}
            <FormField
              control={form.control}
              name="settings.autoSync"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 border p-4">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-1">
                    <FormLabel>Auto Sync</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Automatically sync inventory and orders
                    </p>
                  </div>
                </FormItem>
              )}
            />

            {/* Inventory Sync */}
            <FormField
              control={form.control}
              name="settings.inventorySync"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 border p-4">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-1">
                    <FormLabel>Inventory Sync (ShipBob)</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Enable inventory synchronization
                    </p>
                  </div>
                </FormItem>
              )}
            />

            {/* Order Sync */}
            <FormField
              control={form.control}
              name="settings.orderSync"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 border p-4">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-1">
                    <FormLabel>Order Sync (ShipBob)</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Enable order synchronization
                    </p>
                  </div>
                </FormItem>
              )}
            />

            {/* Sync Interval */}
            <FormField
              control={form.control}
              name="settings.syncInterval"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sync Interval (ms)</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} placeholder="3600000 for 1 hour" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Buttons */}
            <div className="flex justify-end gap-4 mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </Dialog>
  )
}
