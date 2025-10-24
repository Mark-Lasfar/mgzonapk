// /app/api/templates/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectToDatabase } from '@/lib/db';
import Template from '@/lib/db/models/template.model';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    const templates = await Template.find({ $or: [{ createdBy: session.user.id }, { isPublic: true }] });
    return NextResponse.json({ success: true, templates });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await req.json();
    await connectToDatabase();

    const template = await Template.create({
      ...data,
      templateId: crypto.randomUUID(),
      createdBy: session.user.id,
    });

    return NextResponse.json({ success: true, template });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}