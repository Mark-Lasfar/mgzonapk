import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import Message from '@/lib/db/models/message.model';

export async function POST(req: NextRequest, { params }: { params: { storeId: string } }) {
  try {
    const { senderName, senderEmail, message } = await req.json();
    await connectToDatabase();

    const newMessage = await Message.create({
      storeId: params.storeId,
      senderName,
      senderEmail,
      message,
      status: 'pending',
    });

    return NextResponse.json({ success: true, data: newMessage });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function GET(req: NextRequest, { params }: { params: { storeId: string } }) {
  try {
    await connectToDatabase();
    const messages = await Message.find({ storeId: params.storeId }).sort({ createdAt: -1 });
    return NextResponse.json({ success: true, data: messages });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}