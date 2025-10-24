
'use server'

import { connectToDatabase } from '@/lib/db'
import { IOrder, Order } from '@/lib/db/models/order.model'
import Product from '@/lib/db/models/product.model'
import User from '@/lib/db/models/user.model'
import { revalidatePath } from 'next/cache'
import { sendPurchaseReceipt, sendAskReviewOrderItems } from '@/emails'
import { awardPoints } from './points.actions'
import { getSetting } from './setting.actions'
import mongoose from 'mongoose'
import { Cart, OrderItem, ShippingAddress } from '@/types'
import { formatError, round2 } from '../utils'
import { paypal } from '../paypal'
import { OrderInputSchema } from '../validator'
import { auth } from '@/auth'
import SellerIntegration from '@/lib/db/models/seller-integration.model'

interface IOrderList extends IOrder {
  user: { name: string }
}

interface DateRange {
  from: Date
  to: Date
}

// CREATE
export const createOrder = async (clientSideCart: Cart) => {
  try {
    await connectToDatabase()
    const session = await auth()
    if (!session) throw new Error('User not authenticated')
    const createdOrder = await createOrderFromCart(
      clientSideCart,
      session.user.id!
    )
    return {
      success: true,
      message: 'Order placed successfully',
      data: { orderId: createdOrder._id.toString() },
    }
  } catch (error) {
    return { success: false, message: formatError(error) }
  }
}

export const createOrderFromCart = async (
  clientSideCart: Cart,
  userId: string
) => {
  const cart = {
    ...clientSideCart,
    ...calcDeliveryDateAndPrice({
      items: clientSideCart.items,
      shippingAddress: clientSideCart.shippingAddress,
      deliveryDateIndex: clientSideCart.deliveryDateIndex,
    }),
  }

  const order = OrderInputSchema.parse({
    user: userId,
    items: cart.items.map((item) => ({
      ...item,
      color: item.color && typeof item.color === 'object' && 'name' in item.color ? item.color.name : (item.color as string) || 'N/A',
    })),
    shippingAddress: cart.shippingAddress,
    paymentMethod: cart.paymentMethod,
    itemsPrice: cart.itemsPrice,
    shippingPrice: cart.shippingPrice,
    taxPrice: cart.taxPrice,
    totalPrice: cart.totalPrice,
    expectedDeliveryDate: cart.expectedDeliveryDate,
    pointsUsed: cart.pointsUsed || 0,
    pointsDiscount: cart.pointsDiscount || 0,
  })
  return await Order.create(order)
}

export async function updateOrderToPaid(orderId: string) {
  const session = await mongoose.connection.startSession()
  session.startTransaction()
  try {
    await connectToDatabase()
    const order = await Order.findById(orderId).populate<{
      user: { email: string; name: string }
    }>('user', 'name email').session(session)
    if (!order) throw new Error('Order not found')
    if (order.isPaid) throw new Error('Order is already paid')
    order.isPaid = true
    order.paidAt = new Date()
    await order.save({ session })

    const settings = await getSetting()
    const defaultCurrency = settings.defaultCurrency
    const currency = defaultCurrency || 'USD'
    const points = Math.floor(order.totalPrice)
    await awardPoints(order.user.toString(), points, `Purchase on order ${orderId}`, orderId)

    for (const item of order.items) {
      const product = await Product.findById(item.productId).session(session)
      if (product && product.sellerId) {
        const seller = await User.findOne({ businessProfile: product.sellerId }).session(session)
        if (seller) {
          await awardPoints(seller._id.toString(), 10, `Sale of ${item.name} on order ${orderId}`, orderId)
        }
      }
    }

    if (!process.env.MONGODB_URI?.startsWith('mongodb://localhost'))
      await updateProductStock(order.id, session)
    if (order.user.email) await sendPurchaseReceipt({ order })
    await session.commitTransaction()
    revalidatePath(`/account/orders/${orderId}`)
    return { success: true, message: 'Order paid successfully' }
  } catch (err) {
    await session.abortTransaction()
    return { success: false, message: formatError(err) }
  } finally {
    session.endSession()
  }
}

const updateProductStock = async (orderId: string, session: mongoose.ClientSession) => {
  const opts = { session }
  const order = await Order.findOneAndUpdate(
    { _id: orderId },
    { isPaid: true, paidAt: new Date() },
    opts
  )
  if (!order) throw new Error('Order not found')
  for (const item of order.items) {
    const product = await Product.findById(item.productId).session(session)
    if (!product) throw new Error('Product not found')
    product.countInStock -= item.quantity
    await Product.updateOne(
      { _id: product._id },
      { countInStock: product.countInStock },
      opts
    )
  }
}

export async function deliverOrder(orderId: string) {
  try {
    await connectToDatabase()
    const order = await Order.findById(orderId).populate<{
      user: { email: string; name: string }
    }>('user', 'name email')
    if (!order) throw new Error('Order not found')
    if (!order.isPaid) throw new Error('Order is not paid')
    order.isDelivered = true
    order.deliveredAt = new Date()
    await order.save()
    if (order.user.email) await sendAskReviewOrderItems({ order })
    revalidatePath(`/account/orders/${orderId}`)
    return { success: true, message: 'Order delivered successfully' }
  } catch (err) {
    return { success: false, message: formatError(err) }
  }
}

export async function deleteOrder(id: string) {
  try {
    await connectToDatabase()
    const res = await Order.findByIdAndDelete(id)
    if (!res) throw new Error('Order not found')
    revalidatePath('/admin/orders')
    return {
      success: true,
      message: 'Order deleted successfully',
    }
  } catch (error) {
    return { success: false, message: formatError(error) }
  }
}

export async function getAllOrders({
  limit,
  page,
}: {
  limit?: number
  page: number
}) {
  const {
    common: { pageSize },
  } = await getSetting()
  limit = limit || pageSize
  await connectToDatabase()
  const skipAmount = (Number(page) - 1) * limit
  const orders = await Order.find()
    .populate('user', 'name')
    .sort({ createdAt: 'desc' })
    .skip(skipAmount)
    .limit(limit)
  const ordersCount = await Order.countDocuments()
  return {
    data: JSON.parse(JSON.stringify(orders)) as IOrderList[],
    totalPages: Math.ceil(ordersCount / limit),
  }
}

export async function getMyOrders({
  limit,
  page,
}: {
  limit?: number
  page: number
}) {
  const {
    common: { pageSize },
  } = await getSetting()
  limit = limit || pageSize
  await connectToDatabase()
  const session = await auth()
  if (!session) {
    throw new Error('User is not authenticated')
  }
  const skipAmount = (Number(page) - 1) * limit
  const orders = await Order.find({
    user: session?.user?.id,
  })
    .sort({ createdAt: 'desc' })
    .skip(skipAmount)
    .limit(limit)
  const ordersCount = await Order.countDocuments({ user: session?.user?.id })
  return {
    data: JSON.parse(JSON.stringify(orders)),
    totalPages: Math.ceil(ordersCount / limit),
  }
}

export async function getOrderById(orderId: string): Promise<IOrder> {
  await connectToDatabase()
  const order = await Order.findById(orderId)
  return JSON.parse(JSON.stringify(order))
}

export async function createPayPalOrder(orderId: string) {
  await connectToDatabase()
  try {
    const order = await Order.findById(orderId)
    if (order) {
      const paypalOrder = await paypal.createOrder(order.totalPrice)
      order.paymentResult = {
        id: paypalOrder.id,
        email_address: '',
        status: '',
        pricePaid: '0',
      }
      await order.save()
      return {
        success: true,
        message: 'PayPal order created successfully',
        data: paypalOrder.id,
      }
    } else {
      throw new Error('Order not found')
    }
  } catch (err) {
    return { success: false, message: formatError(err) }
  }
}

export async function approvePayPalOrder(
  orderId: string,
  data: { orderID: string }
) {
  await connectToDatabase()
  try {
    const order = await Order.findById(orderId).populate('user', 'email')
    if (!order) throw new Error('Order not found')
    const captureData = await paypal.capturePayment(data.orderID)
    if (
      !captureData ||
      captureData.id !== order.paymentResult?.id ||
      captureData.status !== 'COMPLETED'
    )
      throw new Error('Error in paypal payment')
    order.isPaid = true
    order.paidAt = new Date()
    order.paymentResult = {
      id: captureData.id,
      status: captureData.status,
      email_address: captureData.payer.email_address,
      pricePaid:
        captureData.purchase_units[0]?.payments?.captures[0]?.amount?.value,
    }
    await order.save()

    // التحقق من وجود تكامل البائع مع PayPal
    const sellerIntegration = await SellerIntegration.findOne({
      sellerId: order.sellerId,
      providerName: 'paypal',
      isActive: true,
    })
    if (sellerIntegration?.webhook?.enabled && sellerIntegration.webhook.url) {
      await fetch(sellerIntegration.webhook.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'payment.succeeded',
          data: {
            transactionId: captureData.transactionId,
            orderId: order._id.toString(),
            status: captureData.status,
            metadata: captureData.metadata,
          },
        }),
      })
    }

    await sendPurchaseReceipt({ order })
    revalidatePath(`/account/orders/${orderId}`)
    return {
      success: true,
      message: 'Your order has been successfully paid by PayPal',
    }
  } catch (err) {
    return { success: false, message: formatError(err) }
  }
}

export const calcDeliveryDateAndPrice = async ({
  items,
  shippingAddress,
  deliveryDateIndex,
}: {
  deliveryDateIndex?: number
  items: OrderItem[]
  shippingAddress?: ShippingAddress
}) => {
  const { availableDeliveryDates } = await getSetting()
  const itemsPrice = round2(
    items.reduce((acc, item) => acc + item.price * item.quantity, 0)
  )
  const deliveryDate =
    availableDeliveryDates[
      deliveryDateIndex === undefined
        ? availableDeliveryDates.length - 1
        : deliveryDateIndex
    ]
  const shippingPrice =
    !shippingAddress || !deliveryDate
      ? undefined
      : deliveryDate.freeShippingMinPrice > 0 &&
        itemsPrice >= deliveryDate.freeShippingMinPrice
      ? 0
      : deliveryDate.shippingPrice
  const taxPrice = !shippingAddress ? undefined : round2(itemsPrice * 0.15)
  let totalPrice = round2(
    itemsPrice +
      (shippingPrice ? round2(shippingPrice) : 0) +
      (taxPrice ? round2(taxPrice) : 0)
  )

  const pointsUsed = items[0]?.pointsUsed || 0
  if (pointsUsed > 0) {
    const settings = await getSetting()
    const defaultCurrency = settings.defaultCurrency || 'USD'
    const pointsValue = getPointsValue(defaultCurrency)
    const pointsDiscount = round2(pointsUsed * pointsValue)
    totalPrice = Math.max(0, totalPrice - pointsDiscount)
  }

  return {
    availableDeliveryDates,
    deliveryDateIndex:
      deliveryDateIndex === undefined
        ? availableDeliveryDates.length - 1
        : deliveryDateIndex,
    itemsPrice,
    shippingPrice,
    taxPrice,
    totalPrice,
    pointsUsed,
    pointsDiscount: pointsUsed > 0 ? round2(pointsUsed * getPointsValue('USD')) : 0,
  }
}

function getPointsValue(currency: string): number {
  const rates: Record<string, number> = {
    USD: 0.05,
    EUR: 0.045,
    EGP: 1,
  };
  return rates[currency] || 0.05;
}

export async function getOrderSummary(date: DateRange) {
  await connectToDatabase()
  const ordersCount = await Order.countDocuments({
    createdAt: {
      $gte: date.from,
      $lte: date.to,
    },
  })
  const productsCount = await Product.countDocuments({
    createdAt: {
      $gte: date.from,
      $lte: date.to,
    },
  })
  const usersCount = await User.countDocuments({
    createdAt: {
      $gte: date.from,
      $lte: date.to,
    },
  })
  const totalSalesResult = await Order.aggregate([
    {
      $match: {
        createdAt: {
          $gte: date.from,
          $lte: date.to,
        },
      },
    },
    {
      $group: {
        _id: null,
        sales: { $sum: '$totalPrice' },
      },
    },
    { $project: { totalSales: { $ifNull: ['$sales', 0] } } },
  ])
  const totalSales = totalSalesResult[0] ? totalSalesResult[0].totalSales : 0
  const today = new Date()
  const sixMonthsEarlierDate = new Date(
    today.getFullYear(),
    today.getMonth() - 5,
    1
  )
  const monthlySales = await Order.aggregate([
    {
      $match: {
        createdAt: {
          $gte: sixMonthsEarlierDate,
        },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
        totalSales: { $sum: '$totalPrice' },
      },
    },
    {
      $project: {
        _id: 0,
        label: '$_id',
        value: '$totalSales',
      },
    },
    { $sort: { label: -1 } },
  ])
  const topSalesCategories = JSON.parse(JSON.stringify(await getTopSalesCategories(date)))
  const topSalesProducts = JSON.parse(JSON.stringify(await getTopSalesProducts(date)))
  const {
    common: { pageSize },
  } = await getSetting()
  const limit = pageSize
  const latestOrders = await Order.find()
    .populate('user', 'name')
    .sort({ createdAt: 'desc' })
    .limit(limit)
  return {
    ordersCount,
    productsCount,
    usersCount,
    totalSales,
    monthlySales: JSON.parse(JSON.stringify(monthlySales)),
    salesChartData: JSON.parse(JSON.stringify(await getSalesChartData(date))),
    topSalesCategories,
    topSalesProducts,
    latestOrders: JSON.parse(JSON.stringify(latestOrders)) as IOrderList[],
  }
}

async function getSalesChartData(date: DateRange) {
  const result = await Order.aggregate([
    {
      $match: {
        createdAt: {
          $gte: date.from,
          $lte: date.to,
        },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' },
        },
        totalSales: { $sum: '$totalPrice' },
      },
    },
    {
      $project: {
        _id: 0,
        date: {
          $concat: [
            { $toString: '$_id.year' },
            '/',
            { $toString: '$_id.month' },
            '/',
            { $toString: '$_id.day' },
          ],
        },
        totalSales: 1,
      },
    },
    { $sort: { date: 1 } },
  ])
  return result
}

async function getTopSalesProducts(date: DateRange) {
  const result = await Order.aggregate([
    {
      $match: {
        createdAt: {
          $gte: date.from,
          $lte: date.to,
        },
      },
    },
    { $unwind: '$items' },
    {
      $group: {
        _id: {
          name: '$items.name',
          image: '$items.image',
          _id: '$items.product',
        },
        totalSales: {
          $sum: { $multiply: ['$items.quantity', '$items.price'] },
        },
      },
    },
    {
      $sort: {
        totalSales: -1,
      },
    },
    { $limit: 6 },
    {
      $project: {
        _id: 0,
        id: '$_id._id',
        label: '$_id.name',
        image: '$_id.image',
        value: '$totalSales',
      },
    },
    { $sort: { _id: 1 } },
  ])
  return result
}

async function getTopSalesCategories(date: DateRange) {
  const result = await Order.aggregate([
    {
      $match: {
        createdAt: {
          $gte: date.from,
          $lte: date.to,
        },
      },
    },
    { $unwind: '$items' },
    {
      $lookup: {
        from: 'products',
        localField: 'items.product',
        foreignField: '_id',
        as: 'product',
      },
    },
    { $unwind: '$product' },
    {
      $group: {
        _id: '$product.category',
        totalSales: {
          $sum: { $multiply: ['$items.quantity', '$items.price'] },
        },
      },
    },
    {
      $sort: {
        totalSales: -1,
      },
    },
    { $limit: 5 },
    {
      $project: {
        _id: 0,
        label: '$_id',
        value: '$totalSales',
      },
    },
  ])
  return result
}