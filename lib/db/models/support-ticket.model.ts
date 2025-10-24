// lib/db/models/support-ticket.model.ts
import { Document, Model, model, models, Schema } from 'mongoose';

export interface ISupportTicket extends Document {
  _id: string;
  userId: string; // إما user ID أو email
  email: string; // للتوافق مع الفرونت
  role: 'user' | 'vendor'; // جديد
  orderId?: string; // string مش ObjectId
  integrationId?: string; // جديد
  vendorId?: string; // جديد
  subject: string;
  description: string;
  category: string;
  priority: 'low' | 'medium' | 'high';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  assignedTo?: string;
  messages: {
    sender: string;
    message: string;
    attachments: string[];
    createdAt: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
}

const supportTicketSchema = new Schema<ISupportTicket>(
  {
    userId: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['user', 'vendor'],
      required: true,
    },
    orderId: {
      type: String,
      default: null,
    },
    integrationId: {
      type: String,
      default: null,
    },
    vendorId: {
      type: String,
      default: null,
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
      ref: 'User',
    },
    messages: [
      {
        sender: {
          type: String,
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
);

const SupportTicket = models.SupportTicket ?? model<ISupportTicket>('SupportTicket', supportTicketSchema);

export default SupportTicket;