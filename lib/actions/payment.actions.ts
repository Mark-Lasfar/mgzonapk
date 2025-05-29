import { loadStripe } from '@stripe/stripe-js'
import paypal from '@paypal/rest-sdk'
import { connectToDatabase } from '@/lib/db'
import Seller from '@/lib/db/models/seller.model'
import User from '@/lib/db/models/user.model'
import { sendNotification } from '@/lib/utils/notification'

paypal.configure({
  mode: process.env.PAYPAL_MODE || 'sandbox',
  client_id: process.env.PAYPAL_CLIENT_ID || '',
  client_secret: process.env.PAYPAL_CLIENT_SECRET || '',
})

const stripe = await loadStripe(process.env.STRIPE_SECRET_KEY || '')

interface PaymentOptions {
  userId: string
  amount: number
  currency: string
  paymentMethod: 'stripe' | 'paypal'
  description: string
}

export async function initiatePayment(options: PaymentOptions) {
  const { userId, amount, currency, paymentMethod, description } = options

  try {
    await connectToDatabase()
    const seller = await Seller.findOne({ userId }).lean()
    if (!seller) {
      throw new Error('Seller not found')
    }

    const user = await User.findById(userId).select('whatsapp').lean()
    const channels = user?.whatsapp ? ['email', 'in_app', 'whatsapp'] : ['email', 'in_app']

    let redirectUrl: string

    if (paymentMethod === 'stripe') {
      if (!stripe) {
        throw new Error('Stripe not initialized')
      }
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency,
              product_data: { name: description },
              unit_amount: Math.round(amount * 100),
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/account/subscriptions?success=true`,
        cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/account/subscriptions?cancelled=true`,
        metadata: { userId, description },
      })
      redirectUrl = session.url || ''

      await sendNotification({
        userId,
        type: 'payment_success',
        title: 'Payment Initiated',
        message: `Your payment of $${amount} for ${description} has been initiated.`,
        channels,
        data: { amount, description },
      })
    } else if (paymentMethod === 'paypal') {
      const createPaymentJson = {
        intent: 'sale',
        payer: { payment_method: 'paypal' },
        redirect_urls: {
          return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/account/subscriptions?success=true`,
          cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/account/subscriptions?cancelled=true`,
        },
        transactions: [
          {
            amount: { total: amount.toFixed(2), currency },
            description,
          },
        ],
      }

      redirectUrl = await new Promise((resolve, reject) => {
        paypal.payment.create(createPaymentJson, (error, payment) => {
          if (error) {
            reject(error)
          } else {
            const approvalUrl = payment.links?.find(link => link.rel === 'approval_url')?.href
            resolve(approvalUrl || '')
          }
        })
      })

      await sendNotification({
        userId,
        type: 'payment_success',
        title: 'Payment Initiated',
        message: `Your payment of $${amount} for ${description} has been initiated.`,
        channels,
        data: { amount, description },
      })
    } else {
      throw new Error('Unsupported payment method')
    }

    return { success: true, data: { redirectUrl } }
  } catch (error) {
    console.error('Payment initiation error:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to initiate payment',
    }
  }
}