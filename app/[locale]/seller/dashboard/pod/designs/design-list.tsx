'use client'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { formatDateTime } from '@/lib/utils'
import Image from 'next/image'
import Link from 'next/link'
import Pagination from '@/components/shared/pagination'

export default function DesignList({
  designs,
  totalPages,
  page,
}: {
  designs: any[]
  totalPages: number
  page: number
}) {
  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button asChild>
          <Link href="/seller/dashboard/pod/designs/create">Create Design</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {designs.map((design) => (
          <Card key={design._id}>
            <CardHeader>
              <CardTitle className="text-lg">{design.name}</CardTitle>
            </CardHeader>
<CardContent>
  <div className="aspect-square relative rounded-md overflow-hidden">
    <Image
      src={design.images?.[0] || '/placeholder.png'}
      alt={design.name || 'Unnamed Design'}
      fill
      className="object-cover"
    />
  </div>

  <div className="mt-2 text-sm text-gray-500">
    <p>Created: {formatDateTime(design.createdAt).dateTime}</p>
    <p>Products: {design.products?.length ?? 0}</p>
    <p>Status: {design.isPublished ? 'Published' : 'Draft'}</p>
  </div>
</CardContent>

            <CardFooter className="justify-end space-x-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/seller/dashboard/pod/designs/${design._id}`}>
                  Edit
                </Link>
              </Button>
              <Button asChild size="sm">
                <Link href={`/seller/dashboard/pod/designs/${design._id}/products`}>
                  Add Products
                </Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {totalPages > 1 && <Pagination totalPages={totalPages} page={page} />}
    </div>
  )
}