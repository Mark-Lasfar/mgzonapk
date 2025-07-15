import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectToDatabase } from '@/lib/db';
import Product from '@/lib/db/models/product.model';
import Template from '@/lib/db/models/template.model';

export async function GET(req: NextRequest, { params }: { params: { productId: string } }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    const product = await Product.findById(params.productId).select('templateId');
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const template = await Template.findById(product.templateId);
    return NextResponse.json({ success: true, data: template });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { productId: string } }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sections, showVendor, template } = await req.json();
    await connectToDatabase();
    const product = await Product.findById(params.productId);
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    let templateId = product.templateId;
    if (!templateId) {
      const newTemplate = await Template.create({
        ...template,
        templateId: crypto.randomUUID(),
        createdBy: session.user.id,
      });
      templateId = newTemplate._id;
    } else {
      await Template.updateOne({ _id: templateId }, { $set: { ...template } });
    }

    await Product.updateOne(
      { _id: params.productId },
      { $set: { sections, showVendor, templateId } }
    );

    return NextResponse.json({ success: true, message: 'Template saved' });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}