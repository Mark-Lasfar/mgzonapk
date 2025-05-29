// components/ui/data-table-column-header.tsx

import { ArrowUp, ArrowDown } from 'lucide-react'
import { Column } from '@tanstack/react-table'

interface Props<TData> {
  column: Column<TData, unknown>
  title: string
}

export function DataTableColumnHeader<TData>({ column, title }: Props<TData>) {
  const isSorted = column.getIsSorted()

  return (
    <button
      className="flex items-center gap-1 text-sm font-medium"
      onClick={() => column.toggleSorting(isSorted === 'asc')}
    >
      {title}
      {isSorted === 'asc' && <ArrowUp size={14} />}
      {isSorted === 'desc' && <ArrowDown size={14} />}
    </button>
  )
}
