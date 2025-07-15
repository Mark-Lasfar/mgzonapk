import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { auth } from '@/auth';
import mongoose from 'mongoose';

export async function GET() {
  try {
    const session = await auth();
    if (session?.user?.role !== 'Admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    const components = await mongoose.model('Component').find({}).select('name');
    return NextResponse.json({ components: components.map((c: any) => c.name) });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch components' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (session?.user?.role !== 'Admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { component } = await req.json();
    if (!component) {
      return NextResponse.json({ error: 'Invalid component name' }, { status: 400 });
    }

    await connectToDatabase();
    await mongoose.model('Component').create({ name: component });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to add component' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (session?.user?.role !== 'Admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { component } = await req.json();
    if (!component) {
      return NextResponse.json({ error: 'Invalid component name' }, { status: 400 });
    }

    await connectToDatabase();
    await mongoose.model('Component').deleteOne({ name: component });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete component' }, { status: 500 });
  }
}