import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectToDatabase } from '@/lib/db';
import SellerIntegration from '@/lib/db/models/seller-integration.model';
import Integration from '@/lib/db/models/integration.model';
import { DynamicIntegrationService } from '@/lib/services/integrations';
import { customLogger } from '@/lib/api/services/logging';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { getTranslations } from 'next-intl/server';

const searchSchema = z.object({
  query: z.string().min(1).max(100),
  region: z.string().default('global'),
  limit: z.number().default(10).min(1).max(50),
  category: z.string().optional(),
  priceMin: z.number().optional(),
  priceMax: z.number().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const requestId = uuidv4();
  const t = await getTranslations('seller.integrations');
  
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== 'SELLER') {
      return NextResponse.json({ error: t('Unauthorized') }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const sandbox = searchParams.get('sandbox') === 'true';

    await connectToDatabase(sandbox ? 'sandbox' : 'live');

    // التحقق من التكامل
    const sellerIntegration = await SellerIntegration.findOne({
      sellerId: session.user.id,
      integrationId: params.slug,
      sandbox,
      status: 'connected',
    });

    if (!sellerIntegration) {
      return NextResponse.json(
        { error: t('integrationNotConnected') }, 
        { status: 400 }
      );
    }

    const integration = await Integration.findById(params.slug);
    if (!integration) {
      return NextResponse.json(
        { error: t('integrationNotFound') }, 
        { status: 404 }
      );
    }

    const body = await req.json();
    const validatedData = searchSchema.parse(body);

    // إنشاء DynamicIntegrationService
    const service = new DynamicIntegrationService(
      {
        _id: integration._id.toString(),
        type: integration.type,
        status: sellerIntegration.status,
        providerName: integration.providerName,
        settings: integration.settings,
        logoUrl: integration.logoUrl,
      },
      sellerIntegration
    );

    // جلب المنتجات من التكامل
    const products = await service.searchProducts({
      query: validatedData.query,
      region: validatedData.region,
      limit: validatedData.limit,
      category: validatedData.category,
      priceMin: validatedData.priceMin,
      priceMax: validatedData.priceMax,
    });

    customLogger.info('Dropshipping products fetched', {
      requestId,
      sellerId: session.user.id,
      provider: params.slug,
      query: validatedData.query,
      count: products.length,
    });

    return NextResponse.json({
      success: true,
      data: products.map((product: any) => ({
        productId: product.id,
        title: product.title,
        description: product.description,
        price: product.price,
        currency: product.currency || 'USD',
        imageUrl: product.images?.[0]?.url || '',
        availability: product.availability || 'in_stock',
        category: product.category,
        sku: product.sku,
        supplierId: product.supplierId,
      })),
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch products';
    customLogger.error('Failed to fetch dropshipping products', {
      requestId,
      error: errorMessage,
    });
    
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}