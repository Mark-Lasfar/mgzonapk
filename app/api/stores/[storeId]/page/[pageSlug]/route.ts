// /app/api/stores/[storeId]/page/[pageSlug]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectToDatabase } from '@/lib/db';
import Store from '@/lib/db/models/store.model';

export async function GET(req: NextRequest, { params }: { params: { storeId: string; pageSlug: string } }) {
  try {
    await connectToDatabase();
    const store = await Store.findOne({ storeId: params.storeId }).select('settings.customSite');
    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    const page = store.settings.customSite.customSections.find((section: any) => section.slug === params.pageSlug);
    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: { settings: store.settings, page } });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
