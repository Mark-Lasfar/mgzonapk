import { Metadata } from 'next'
import { getProducts } from '@/lib/actions/seller.actions'
import { auth } from '@/auth'
import ProductList from './product-list'

export const metadata: Metadata = {
  title: 'Products - Seller Dashboard',
  description: 'Manage your products'
}

export default async function ProductsPage() {
  const session = await auth()
  
  if (!session?.user?.id) {
    return null // Handle in layout
  }

  const response = await getProducts(session.user.id)
  
  return (
    <div className="container py-6">
      <ProductList initialData={response.data} />
    </div>
  )
}