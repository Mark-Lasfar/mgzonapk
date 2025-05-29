// components/ui/data-table-row-actions.tsx

import { Button } from '@/components/ui/button'
import { DotsHorizontalIcon } from '@radix-ui/react-icons'

interface Props {
  row: any // بدل any بـ النوع الحقيقي لو عندك
}

export function DataTableRowActions({ row }: Props) {
  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="outline" onClick={() => console.log('Edit', row.original)}>
        Edit
      </Button>
      <Button size="sm" variant="destructive" onClick={() => console.log('Delete', row.original)}>
        Delete
      </Button>
    </div>
  )
}
