// lib/db/models/chatHistory.model.ts
import mongoose, { Schema, model, models, Document } from 'mongoose';

interface IChatMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  template?: {
    id: string;
    templateId: string;
    name: string;
    theme: 'light' | 'dark';
    sections: Array<{
      id: string;
      type: string;
      content: Record<string, any>;
      position: number;
    }>;
    backgroundImage?: string;
  };
  product?: {
    id: string;
    name: string;
    description: string;
    price: number;
    images: string[];
  };
  createdAt: Date;
}

interface IChatHistory extends Document {
  sellerId: mongoose.Types.ObjectId;
  messages: IChatMessage[];
  updatedAt: Date;
}

const chatMessageSchema = new Schema<IChatMessage>(
  {
    role: {
      type: String,
      enum: ['user', 'assistant', 'tool'],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    template: {
      id: { type: String },
      templateId: { type: String },
      name: { type: String },
      theme: { type: String, enum: ['light', 'dark'] },
      sections: [
        {
          id: { type: String, required: true },
          type: { type: String, required: true },
          content: { type: Schema.Types.Mixed, required: true },
          position: { type: Number, required: true },
          _id: false,
        },
      ],
      backgroundImage: { type: String },
    },
    product: {
      id: { type: String },
      name: { type: String },
      description: { type: String },
      price: { type: Number },
      images: [{ type: String }],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const chatHistorySchema = new Schema<IChatHistory>(
  {
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: 'Seller',
      required: true,
      index: true,
    },
    messages: [chatMessageSchema],
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// فهرسة لتحسين الأداء
chatHistorySchema.index({ sellerId: 1, updatedAt: 1 });

// تنظيف الرسائل الأقدم من 10 أيام قبل الحفظ
chatHistorySchema.pre('save', function (next) {
  const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
  this.messages = this.messages.filter(
    (msg: IChatMessage) => msg.createdAt >= tenDaysAgo
  );
  this.updatedAt = new Date();
  next();
});

const ChatHistory = models.ChatHistory || model<IChatHistory>('ChatHistory', chatHistorySchema);
export default ChatHistory;