import { notFound } from 'next/navigation'
import { getUserById } from '@/lib/actions/user.actions'
import { getPointsBalance, getPointsHistory, awardPoints, redeemPoints } from '@/lib/actions/points.actions'
import UserEditForm from './user-edit-form'
import Link from 'next/link'
import { Metadata } from 'next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label' // Added import for Label
import { formatDateTime } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Edit User',
}

export default async function UserEditPage(props: {
  params: Promise<{
    id: string
  }>
}) {
  const params = await props.params
  const { id } = params
  const user = await getUserById(id)
  if (!user) notFound()
  const pointsBalance = await getPointsBalance(id)
  const pointsHistory = await getPointsHistory(id)

  const handleAdjustPoints = async (formData: FormData) => {
    'use server'
    const action = formData.get('action') as 'award' | 'deduct'
    const amount = Number(formData.get('amount'))
    const description = formData.get('description') as string
    try {
      if (action === 'award') {
        await awardPoints(id, amount, description)
      } else {
        await redeemPoints(id, amount, 'USD', description)
      }
      return { success: true, message: 'Points adjusted successfully' }
    } catch (error) {
      return { success: false, message: formatError(error) }
    }
  }

  return (
    <main className="max-w-6xl mx-auto p-4">
      <div className="flex mb-4">
        <Link href="/admin/users">Users</Link>
        <span className="mx-1">›</span>
        <Link href={`/admin/users/${user._id}`}>{user._id}</Link>
      </div>
      <div className="my-8">
        <UserEditForm user={user} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Points Management</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Current Points Balance: {pointsBalance}</p>
          <form action={handleAdjustPoints} className="space-y-4 mt-4">
            <div>
              <Label htmlFor="action">Action</Label>
              <select id="action" name="action" className="border p-2 w-full">
                <option value="award">Award Points</option>
                <option value="deduct">Deduct Points</option>
              </select>
            </div>
            <div>
              <Label htmlFor="amount">Amount</Label>
              <Input id="amount" name="amount" type="number" min="1" required />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Input id="description" name="description" required />
            </div>
            <Button type="submit">Adjust Points</Button>
          </form>
          <h3 className="text-lg font-bold mt-6">Points History</h3>
          {pointsHistory.length > 0 ? (
            <ul className="space-y-2 mt-2">
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
        </CardContent>
      </Card>
    </main>
  )
}