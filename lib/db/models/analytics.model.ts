import { Document, Model, model, models, Schema } from 'mongoose'

export interface IAnalytics extends Document {
  _id: string
  type: 'product' | 'seller' | 'order' | 'user' | 'revenue'
  date: Date
  data: {
    [key: string]: any
    totalSales?: number
    totalOrders?: number
    averageOrderValue?: number
    conversionRate?: number
    visitors?: number
    newCustomers?: number
    repeatCustomers?: number
    topProducts?: {
      productId: string
      name: string
      sales: number
      revenue: number
    }[]
    categoryPerformance?: {
      category: string
      sales: number
      revenue: number
    }[]
  }
  metadata?: {
    [key: string]: any
  }
}

const analyticsSchema = new Schema<IAnalytics>(
  {
    type: {
      type: String,
      enum: ['product', 'seller', 'order', 'user', 'revenue'],
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    data: {
      type: Schema.Types.Mixed,
      required: true,
    },
    metadata: Schema.Types.Mixed,
  },
  {
    timestamps: true,
  }
)

const Analytics = (models.Analytics as Model<IAnalytics>) || model<IAnalytics>('Analytics', analyticsSchema)

export default Analytics