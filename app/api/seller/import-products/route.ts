// app/api/seller/import-products/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ProductImportService } from '@/lib/api/services/product-import';

const importService = new ProductImportService({
  shopify: {
    apiKey: process.env.SHOPIFY_API_KEY!,
    apiSecret: process.env.SHOPIFY_API_SECRET!,
    domain: process.env.SHOPIFY_DOMAIN!,
  },
  amazon: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    region: process.env.AWS_REGION!,
  },
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { source, productIds } = await req.json();
    let products;
    if (source === 'shopify') {
      products = await importService.importFromShopify(session.user.id, productIds);
    } else if (source === 'amazon') {
      products = await importService.importFromAmazon(session.user.id, productIds);
    } else {
      return NextResponse.json({ success: false, error: 'Invalid source' }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: products });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Import failed' }, { status: 500 });
  }
}