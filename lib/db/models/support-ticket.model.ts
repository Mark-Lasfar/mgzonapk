import { Document, Model, model, models, Schema } from 'mongoose'

export interface ISupportTicket extends Document {
  _id: string
  userId: string
  orderId?: string
  subject: string
  description: string
  category: string
  priority: 'low' | 'medium' | 'high'
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  assignedTo?: string
  messages: {
    sender: string
    message: string
    attachments: string[]
    createdAt: Date
  }[]
  createdAt: Date
  updatedAt: Date
  resolvedAt?: Date
}

const supportTicketSchema = new Schema<ISupportTicket>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'user',
      required: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
    },
    subject: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'resolved', 'closed'],
      default: 'open',
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'user',
    },
    messages: [
      {
        sender: {
          type: Schema.Types.ObjectId,
          ref: 'user',
          required: true,
        },
        message: {
          type: String,
          required: true,
        },
        attachments: [String],
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    resolvedAt: Date,
  },
  {
    timestamps: true,
  }
)

const SupportTicket =
  (models.SupportTicket as Model<ISupportTicket>) ||
  model<ISupportTicket>('SupportTicket', supportTicketSchema)

export default SupportTicket