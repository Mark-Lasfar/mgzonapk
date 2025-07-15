import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectToDatabase } from '@/lib/db';
import Seller from '@/lib/db/models/seller.model';
import { z } from 'zod';

const settingsSchema = z.object({
  notifications: z.object({
    email: z.boolean(),
    sms: z.boolean(),
    orderUpdates: z.boolean(),
    marketingEmails: z.boolean(),
    pointsNotifications: z.boolean(),
  }),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== 'SELLER') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { settings } = await req.json();
    const validatedData = settingsSchema.parse({ notifications: settings.notifications });

    await connectToDatabase();
    const seller = await Seller.findOneAndUpdate(
      { userId: session.user.id },
      { $set: { 'settings.notifications': validatedData.notifications } },
      { new: true, upsert: true }
    );

    return NextResponse.json({ success: true, data: seller });
  } catch (error) {
    console.error('Error updating seller settings:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update settings' },
      { status: 500 }
    );
  }
}