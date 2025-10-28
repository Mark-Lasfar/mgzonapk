'use client'

import { useEffect, useState } from 'react'
import { DataTable } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { PlusCircle } from 'lucide-react'
import { columns } from './columns'
import { WarehouseDialog } from './warehouse-dialog'
import { useToast } from '@/components/ui/toast'
import { getWarehouses } from '@/lib/actions/warehouse.actions'
import { IWarehouse } from '@/types'

export default function WarehousesPage() {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [warehouses, setWarehouses] = useState<IWarehouse[]>([])
  const [selectedWarehouse, setSelectedWarehouse] = useState<IWarehouse | null>(null)

  useEffect(() => {
    loadWarehouses()
  }, [])

  async function loadWarehouses() {
    try {
      setLoading(true)
      const res = await getWarehouses()
      if (res.success) {
        setWarehouses(res.data)
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: res.message
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load warehouses'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Warehouse Management</h1>
        <Button onClick={() => {
          setSelectedWarehouse(null)
          setOpen(true)
        }}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Warehouse
        </Button>
      </div>

      <DataTable 
        columns={columns} 
        data={warehouses}
        loading={loading}
        onRefresh={loadWarehouses}
      />

      <WarehouseDialog 
        warehouse={selectedWarehouse}
        open={open} 
        onClose={() => {
          setOpen(false)
          setSelectedWarehouse(null)
        }}
        onSuccess={() => {
          setOpen(false)
          setSelectedWarehouse(null)
          loadWarehouses()
        }}
      />
    </div>
  )
}