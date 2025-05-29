'use client'

import { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { IWarehouse } from '@/types'
import { Button } from '@/components/ui/button'

export const columns: ColumnDef<IWarehouse>[] = [
  {
    accessorKey: 'name',
    header: 'Name'
  },
  {
    accessorKey: 'code',
    header: 'Code'
  },
  {
    accessorKey: 'provider',
    header: 'Provider'
  },
  {
    accessorKey: 'location',
    header: 'Location'
  },
  {
    accessorKey: 'isActive',
    header: 'Status',
    cell: ({ row }) => (
      <Badge variant={row.original.isActive ? 'default' : 'secondary'}>
        {row.original.isActive ? 'Active' : 'Inactive'}
      </Badge>
    )
  },
  {
    accessorKey: 'updatedAt',
    header: 'Last Updated',
    cell: ({ row }) => format(new Date(row.original.updatedAt), 'PPp')
  },
  {
    accessorKey: 'products',
    header: 'Products',
    cell: ({ row }) => row.original.products.size
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row }) => (
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => {}}>Edit</Button>
        <Button variant="outline" size="sm" onClick={() => {}}>Sync</Button>
        <Button variant="destructive" size="sm" onClick={() => {}}>Delete</Button>
      </div>
    )
  }
]
