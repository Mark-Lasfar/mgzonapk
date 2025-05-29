import { auth } from '@/auth'
import BrowsingHistoryList from '@/components/shared/browsing-history-list'
import { Card, CardContent } from '@/components/ui/card'
import { Home, PackageCheckIcon, User, Crown, Briefcase } from 'lucide-react'
import { Metadata } from 'next'
import Link from 'next/link'
import { getPointsBalance, getPointsHistory } from '@/lib/actions/points.actions'
import { formatDateTime } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Your Account',
}

export default async function AccountPage() {
  const session = await auth()
  if (!session?.user?.id) {
    return <div>Please log in</div>
  }

  const userRole = session.user.role || 'user'
  const isAdmin = userRole === 'Admin'
  const isSeller = userRole === 'SELLER'

  let pointsBalance = 0
  let pointsHistory: Array<{ _id: string; amount: number; type: 'earn' | 'redeem'; description: string; createdAt: Date }> = []

  try {
    pointsBalance = await getPointsBalance(session.user.id)
    pointsHistory = await getPointsHistory(session.user.id)
  } catch (error) {
    console.error('Error fetching points:', error)
  }

  return (
    <div>
      <h1 className="h1-bold py-4">Your Account</h1>
      <div className="grid md:grid-cols-3 gap-4 items-stretch">
        <Card>
          <Link href="/account/orders">
            <CardContent className="flex items-start gap-4 p-6">
              <PackageCheckIcon className="w-12 h-12" />
              <div>
                <h2 className="text-xl font-bold">Orders</h2>
                <p className="text-muted-foreground">
                  Track, return, cancel an order, download invoice or buy again
                </p>
              </div>
            </CardContent>
          </Link>
        </Card>
        <Card>
          <Link href="/account/manage">
            <CardContent className="flex items-start gap-4 p-6">
              <User className="w-12 h-12" />
              <div>
                <h2 className="text-xl font-bold">Login & Security</h2>
                <p className="text-muted-foreground">
                  Manage password, email and mobile number
                </p>
              </div>
            </CardContent>
          </Link>
        </Card>
        <Card>
          <Link href="/account/addresses">
            <CardContent className="flex items-start gap-4 p-6">
              <Home className="w-12 h-12" />
              <div>
                <h2 className="text-xl font-bold">Addresses</h2>
                <p className="text-muted-foreground">
                  Edit, remove or set default address
                </p>
              </div>
            </CardContent>
          </Link>
        </Card>
        <Card>
          <Link href="/account/subscriptions">
            <CardContent className="flex items-start gap-4 p-6">
              <Crown className="w-12 h-12" />
              <div>
                <h2 className="text-xl font-bold">Subscriptions</h2>
                <p className="text-muted-foreground">
                  Explore or manage your subscription plans.
                </p>
              </div>
            </CardContent>
          </Link>
        </Card>
        {isSeller ? (
          <Card>
            <Link href="/seller/dashboard">
              <CardContent className="flex items-start gap-4 p-6">
                <Briefcase className="w-12 h-12" />
                <div>
                  <h2 className="text-xl font-bold">Seller Dashboard</h2>
                  <p className="text-muted-foreground">
                    Manage your products, orders, and analytics.
                  </p>
                </div>
            </CardContent>
            </Link>
          </Card>
        ) : (
          <Card>
            <Link href="/seller/registration">
              <CardContent className="flex items-start gap-4 p-6">
                <Briefcase className="w-12 h-12" />
                <div>
                  <h2 className="text-xl font-bold">Start Selling</h2>
                  <p className="text-muted-foreground">
                    Try selling and earning with us. Register as a seller.
                  </p>
                </div>
              </CardContent>
            </Link>
          </Card>
        )}
      </div>
      {(isAdmin || isSeller) && (
        <div className="mt-8">
          <h2 className="text-xl font-bold">Your Role</h2>
          <p className="text-muted-foreground">
            You are logged in as: {userRole}
          </p>
        </div>
      )}
      <div className="mt-8">
        <h2 className="text-xl font-bold">Points Balance</h2>
        <p className="text-muted-foreground">Your current points: {pointsBalance}</p>
        <h3 className="text-lg font-bold mt-4">Points History</h3>
        <div className="mt-2">
          {pointsHistory.length > 0 ? (
            <ul className="space-y-2">
              {pointsHistory.map((tx) => (
                <li key={tx._id} className="border-b py-2">
                  <p>{tx.description}</p>
                  <p>
                    {tx.type === 'earn' ? '+' : '-'}{tx.amount} points on{' '}
                    {formatDateTime(tx.createdAt).dateTime}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p>No points transactions yet.</p>
          )}
        </div>
      </div>
      <BrowsingHistoryList className="mt-16" />
    </div>
  )
}