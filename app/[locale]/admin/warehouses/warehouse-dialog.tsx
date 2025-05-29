'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
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
import { IWarehouse, IWarehouseInput } from '@/types'
import { createWarehouse, updateWarehouse } from '@/lib/actions/warehouse.actions'

interface WarehouseDialogProps {
  warehouse?: IWarehouse | null
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

const CURRENT_DATE = new Date('2025-05-07 02:45:30')
const CURRENT_USER = '4gels'

export function WarehouseDialog({ 
  warehouse,
  open, 
  onClose,
  onSuccess 
}: WarehouseDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const form = useForm<IWarehouseInput>({
    defaultValues: warehouse || {
      name: '',
      code: '',
      provider: 'ShipBob',
      apiKey: '',
      apiUrl: '',
      location: '',
      isActive: true,
      settings: {
        autoSync: true,
        syncInterval: 3600000 // 1 hour
      }
    }
  })

  async function onSubmit(data: IWarehouseInput) {
    try {
      setLoading(true)
      console.log(`[${CURRENT_DATE.toISOString()}] Submitting warehouse data:`, data)

      const res = warehouse 
        ? await updateWarehouse({ ...data, _id: warehouse._id })
        : await createWarehouse(data)

      if (res.success) {
        toast({
          title: 'Success',
          description: res.message
        })
        onSuccess()
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: res.message
        })
      }
    } catch (error) {
      console.error('Warehouse submission error:', error)
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save warehouse'
      })
    } finally {
      setLoading(false)
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
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Code</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="provider"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Provider</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
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

            <FormField
              control={form.control}
              name="apiKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API Key</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="apiUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API URL</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Active</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      This warehouse is currently active and can process orders
                    </p>
                  </div>
                </FormItem>
              )}
            />

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