import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import Setting from '@/lib/db/models/setting.model';
import { customLogger } from '@/lib/api/services/logging';


export async function GET() {
  try {
    await connectToDatabase();
    const settings = await Setting.findOne().select('aiAssistant');
    if (!settings) {
      customLogger.error('Settings not found', { service: 'settings-ai' });
      return NextResponse.json({ message: 'Settings not found' }, { status: 404 });
    }

    return NextResponse.json({
      price: settings.aiAssistant.price,
      description: settings.aiAssistant.description,
      image: settings.aiAssistant.image,
      enabled: settings.aiAssistant.enabled,
      freeLimit: settings.aiAssistant.freeLimit,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    customLogger.error('Failed to fetch AI settings', { service: 'settings-ai', error: errorMessage });
    return NextResponse.json({ message: 'Internal Server Error', error: errorMessage }, { status: 500 });
  }
}