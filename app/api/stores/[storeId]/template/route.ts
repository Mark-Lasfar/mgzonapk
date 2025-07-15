import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectToDatabase } from '@/lib/db';
import Store from '@/lib/db/models/store.model';
import Template from '@/lib/db/models/template.model';

export async function GET(req: NextRequest, { params }: { params: { storeId: string } }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const store = await Store.findOne({ storeId: params.storeId }).select('templateId');
    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    const template = await Template.findById(store.templateId);
    return NextResponse.json({ success: true, data: template });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { storeId: string } }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const templateData = await req.json();
    await connectToDatabase();

    const store = await Store.findOne({ storeId: params.storeId });
    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    let templateId = store.templateId;
    if (!templateId) {
      const newTemplate = await Template.create({
        ...templateData,
        templateId: crypto.randomUUID(),
        createdBy: session.user.id,
      });
      templateId = newTemplate._id;
    } else {
      await Template.updateOne({ _id: templateId }, { $set: { ...templateData } });
    }

    await Store.updateOne(
      { storeId: params.storeId },
      { $set: { templateId } }
    );

    return NextResponse.json({ success: true, message: 'Store template saved' });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}