import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import Partner from '@/lib/db/models/partner.model';
import { auth } from '@/auth';
import { getTranslations } from 'next-intl/server';

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    const partners = await Partner.find().select('name email image slug description socialLinks');
    return NextResponse.json({ success: true, data: partners });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch partners' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (session?.user?.role !== 'Admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await req.json();
    await connectToDatabase();
    const partner = await Partner.create(data);
    return NextResponse.json({ success: true, data: partner });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to create partner' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (session?.user?.role !== 'Admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, ...data } = await req.json();
    await connectToDatabase();
    const partner = await Partner.findByIdAndUpdate(id, data, { new: true });
    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: partner });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to update partner' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (session?.user?.role !== 'Admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await req.json();
    await connectToDatabase();
    const partner = await Partner.findByIdAndDelete(id);
    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to delete partner' }, { status: 500 });
  }
}