import { NextRequest, NextResponse } from 'next/server';
import { customLogger } from '@/lib/api/services/logging';

export async function POST(req: NextRequest) {
  try {
    const { type, message, error, meta } = await req.json();
    if (!type || !message) {
      return NextResponse.json({ success: false, message: 'Invalid log data' }, { status: 400 });
    }

    if (type === 'error') {
      await customLogger.error(message, error, meta);
    } else if (type === 'info') {
      await customLogger.info(message, meta);
    } else {
      return NextResponse.json({ success: false, message: 'Invalid log type' }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Log recorded' });
  } catch (err) {
    console.error('Error in /api/log:', err);
    return NextResponse.json({ success: false, message: 'Failed to record log' }, { status: 500 });
  }
}