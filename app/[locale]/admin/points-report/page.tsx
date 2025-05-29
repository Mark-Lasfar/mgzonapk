import { connectToDatabase } from '@/lib/db'
import PointsTransaction from '@/lib/db/models/points-transaction.model'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDateTime } from '@/lib/utils'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Points Report',
}

export default async function PointsReportPage() {
  await connectToDatabase()
  const totalEarned = await PointsTransaction.aggregate([
    { $match: { type: 'earn' } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ])
  const totalRedeemed = await PointsTransaction.aggregate([
    { $match: { type: 'redeem' } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ])
  const recentTransactions = await PointsTransaction.find()
    .sort({ createdAt: -1 })
    .limit(10)

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h1 className="h1-bold py-4">Points Report</h1>
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Points Earned</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{totalEarned[0]?.total || 0} points</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total Points Redeemed</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{totalRedeemed[0]?.total || 0} points</p>
          </CardContent>
        </Card>
      </div>
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {recentTransactions.length > 0 ? (
            <ul className="space-y-2">
              {recentTransactions.map((tx) => (
                <li key={tx._id} className="border-b py-2">
                  <p>{tx.description}</p>
                  <p>
                    {tx.type === 'earn' ? '+' : '-'}{tx.amount} points by user {tx.userId} on{' '}
                    {formatDateTime(tx.createdAt).dateTime}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p>No recent transactions.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}