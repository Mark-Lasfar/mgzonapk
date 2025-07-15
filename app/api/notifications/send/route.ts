import { NextRequest, NextResponse } from 'next/server';
import { sendTicketNotification } from '@/lib/email/sendTicketNotification';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, to, subject, message } = body;

    if (!userId || !to || !subject || !message) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const result = await sendTicketNotification({
      userId,
      to,
      subject,
      message,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('API notification error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send notification',
      },
      { status: 500 }
    );
  }
}