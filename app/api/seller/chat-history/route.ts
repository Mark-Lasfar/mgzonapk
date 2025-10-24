// app/api/seller/chat-history/route.ts
import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectToDatabase, customLogger } from '@/lib/db';
import ChatHistory from '@/lib/db/models/chatHistory.model';
import { getSession } from 'next-auth/react';

export async function GET(req: Request) {
  const mode = process.env.NODE_ENV === 'development' ? 'sandbox' : 'live';
  const { searchParams } = new URL(req.url);
  const sellerId = searchParams.get('sellerId');

  try {
    const session = await getSession({ req });
    if (!session || !session.user?.id || session.user.id !== sellerId) {
      customLogger.error('Unauthorized access attempt', { service: 'chat-history', sellerId });
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    if (!sellerId || !mongoose.Types.ObjectId.isValid(sellerId)) {
      customLogger.error('Invalid or missing sellerId', { service: 'chat-history', sellerId });
      return NextResponse.json({ message: 'Invalid or missing sellerId' }, { status: 400 });
    }

    await connectToDatabase(mode);
    const chatHistory = await ChatHistory.findOne({ sellerId }).lean();
    return NextResponse.json({ messages: chatHistory?.messages || [] }, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    customLogger.error('Failed to fetch chat history', { service: 'chat-history', error: errorMessage });
    return NextResponse.json({ message: 'Internal Server Error', error: errorMessage }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const mode = process.env.NODE_ENV === 'development' ? 'sandbox' : 'live';
  try {
    const { sellerId, messages } = await req.json();
    const session = await getSession({ req });
    if (!session || !session.user?.id || session.user.id !== sellerId) {
      customLogger.error('Unauthorized access attempt', { service: 'chat-history', sellerId });
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    if (!sellerId || !mongoose.Types.ObjectId.isValid(sellerId)) {
      customLogger.error('Invalid or missing sellerId', { service: 'chat-history', sellerId });
      return NextResponse.json({ message: 'Invalid or missing sellerId' }, { status: 400 });
    }

    await connectToDatabase(mode);
    await ChatHistory.findOneAndUpdate(
      { sellerId },
      { messages, updatedAt: new Date() },
      { upsert: true, new: true }
    );

    customLogger.info('Chat history saved successfully', { service: 'chat-history', sellerId });
    return NextResponse.json({ message: 'Chat history saved successfully' }, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    customLogger.error('Failed to save chat history', { service: 'chat-history', error: errorMessage });
    return NextResponse.json({ message: 'Internal Server Error', error: errorMessage }, { status: 500 });
  }
}