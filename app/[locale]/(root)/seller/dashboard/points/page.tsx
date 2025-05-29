import { auth } from '@/auth'
import { getSellerMetrics } from '@/lib/actions/seller.actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDateTime } from '@/lib/utils'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Seller Points Dashboard',
}

export default async function SellerPointsDashboard() {
  const session = await auth()
  if (!session?.user?.id) {
    return <div>Unauthorized</div>
  }

  const metrics = await getSellerMetrics(session.user.id)
  const points = metrics.points

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h1 className="h1-bold py-4">Points Dashboard</h1>
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Points Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{points.balance} points</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total Earned</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{points.totalEarned} points</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total Redeemed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{points.totalRedeemed} points</p>
          </CardContent>
        </Card>
      </div>
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {points.recentTransactions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {points.recentTransactions.map((tx, index) => (
                  <TableRow key={index}>
                    <TableCell>{formatDateTime(tx.createdAt).dateTime}</TableCell>
                    <TableCell>{tx.type === 'earn' ? 'Earned' : 'Redeemed'}</TableCell>
                    <TableCell>{tx.type === 'earn' ? '+' : '-'}{tx.amount}</TableCell>
                    <TableCell>{tx.description}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p>No recent transactions.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}