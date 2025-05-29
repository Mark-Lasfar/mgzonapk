import { Metadata } from 'next'
import { auth } from '@/auth'
import { getSellerOrders } from '@/lib/actions/seller.actions'
import OrderList from './order-list'

export const metadata: Metadata = {
  title: 'Seller Orders',
}

export default async function SellerOrders({
  searchParams,
}: {
  searchParams: { page?: string; status?: string }
}) {
  const [session] = await Promise.all([
    auth(),
  ])

  if (!session?.user?.id) {
    redirect('/sign-in');
  }

  const page = Number(searchParams.page) || 1
  const { data } = await getSellerOrders(session.user.id, {
    page,
    status: searchParams.status,
  })

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Orders</h1>
      <OrderList orders={data.orders} totalPages={data.totalPages} page={page} />
    </div>
  )
}