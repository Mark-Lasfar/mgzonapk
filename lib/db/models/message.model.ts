import mongoose, { Schema, model, models, Document } from 'mongoose';

interface IMessage extends Document {
  storeId: string;
  senderName: string;
  senderEmail: string;
  message: string;
  status: 'pending' | 'replied' | 'closed';
  createdAt: Date;
  updatedAt: Date;
  reply?: string;
}

const messageSchema = new Schema<IMessage>(
  {
    storeId: { type: String, required: true, index: true },
    senderName: { type: String, required: true, trim: true },
    senderEmail: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    status: { type: String, enum: ['pending', 'replied', 'closed'], default: 'pending' },
    reply: { type: String, trim: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const Message = models.Message || model<IMessage>('Message', messageSchema);
export default Message;