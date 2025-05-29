import { Metadata } from 'next'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { auth } from '@/auth'
import { getSellerByUserId, updateSellerSubscription } from '@/lib/actions/seller.actions'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

export const metadata: Metadata = {
  title: 'Redeem Points for Subscription',
}

interface SubscriptionPlan {
  id: string
  name: string
  pointsCost: number
}

const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  { id: 'trial', name: 'Trial', pointsCost: 20 },
  { id: 'basic', name: 'Basic', pointsCost: 200 },
  { id: 'pro', name: 'Pro', pointsCost: 600 },
  { id: 'vip', name: 'VIP', pointsCost: 2000 },
]

export default async function RedeemPointsPage({ searchParams }: { searchParams: { planId?: string } }) {
  const t = await getTranslations('api')
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/sign-in')
  }

  const sellerResult = await getSellerByUserId(session.user.id)
  if (!sellerResult.success) {
    return <div>{t('errors.sellerNotFound')}</div>
  }
  const seller = sellerResult.data

  const planId = searchParams.planId
  const plan = SUBSCRIPTION_PLANS.find((p) => p.id === planId)
  if (!plan) {
    return <div>{t('errors.invalidPlan')}</div>
  }

  async function handleRedeem(formData: FormData) {
    'use server'
    try {
      const result = await updateSellerSubscription(
        session.user.id,
        plan.name as 'Trial' | 'Basic' | 'Pro' | 'VIP',
        plan.pointsCost
      )
      if (!result.success) {
        return { success: false, message: result.error || t('errors.failedToRedeemPoints') }
      }
      redirect('/account/subscriptions')
    } catch (error) {
      return { success: false, message: t('errors.failedToRedeemPoints') }
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h1 className="h1-bold py-4">Redeem Points for {plan.name}</h1>
      <Card>
        <CardContent className="p-6">
          <p>Plan: {plan.name}</p>
          <p>Points Required: {plan.pointsCost}</p>
          <p>Your Points Balance: {seller.pointsBalance}</p>
          {seller.pointsBalance < plan.pointsCost && (
            <p className="text-destructive">{t('errors.insufficientPoints')}</p>
          )}
        </CardContent>
        <CardFooter>
          <form action={handleRedeem}>
            <Button
              type="submit"
              className="w-full"
              disabled={seller.pointsBalance < plan.pointsCost}
            >
              Confirm Redemption
            </Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  )
}