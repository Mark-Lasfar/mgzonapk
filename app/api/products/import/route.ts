import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import Product from '@/lib/db/models/product.model';
import Seller from '@/lib/db/models/seller.model';
import Integration from '@/lib/db/models/integration.model';
import SellerIntegration from '@/lib/db/models/seller-integration.model';
import { ProductImportService } from '@/lib/api/services/product-import';
import { customLogger } from '@/lib/api/services/logging';
import { auth } from '@/auth';
import { MarketplaceProduct } from '@/lib/types/marketplace';
import { SellerError } from '@/lib/errors/seller-error';
import { readXMLFile, validateXML } from '@/lib/utils/xml';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    await connectToDatabase();
    const session = await auth();
    if (!session?.user?.id) {
      await customLogger.error('Unauthorized product import request', { requestId, service: 'api' });
      throw new SellerError('UNAUTHORIZED', 'Unauthorized');
    }

    const contentType = request.headers.get('content-type');
    let provider: string, productId: string, products: any[], sellerId: string, region: string = 'global';

    if (contentType?.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File;
      provider = formData.get('provider') as string || 'file';
      sellerId = formData.get('sellerId') as string;
      region = formData.get('region') as string || 'global';

      if (!file) {
        throw new SellerError('INVALID_REQUEST', 'No file provided');
      }

      const content = await file.text();
      const validation = validateXML(content, ['title', 'price', 'sku', 'quantity']);
      if (!validation.valid) {
        throw new SellerError('INVALID_XML', `Invalid XML: ${validation.errors.join(', ')}`);
      }

      products = await readXMLFile<any>(file.name, {
        numberFields: ['price', 'quantity'],
        currencyFields: ['currency'],
        arrayFields: ['images', 'categories'],
      });
    } else {
      const body = await request.json();
      provider = body.provider;
      productId = body.productId;
      products = body.products;
      sellerId = body.sellerId;
      region = body.region || 'global';
    }

    if (!provider || (!productId && !products)) {
      await customLogger.error('Invalid import request', { requestId, provider, productId, service: 'api' });
      throw new SellerError('INVALID_REQUEST', 'Provider and productId or products are required');
    }

    const seller = await Seller.findOne({ userId: session.user.id });
    if (!seller || seller._id.toString() !== sellerId) {
      await customLogger.error('Seller not found or unauthorized', { requestId, userId: session.user.id, sellerId, service: 'api' });
      throw new SellerError('SELLER_NOT_FOUND', 'Seller not found or unauthorized');
    }

    const importService = new ProductImportService();
    const importedProducts: MarketplaceProduct[] = [];

    if (provider === 'file') {
      if (!products || !Array.isArray(products)) {
        await customLogger.error('Invalid products data for file import', { requestId, service: 'api' });
        throw new SellerError('INVALID_DATA', 'Invalid products data');
      }

      for (const item of products) {
        const product = await Product.create({
          title: item.title,
          description: item.description || 'No description provided',
          price: item.price,
          images: (item.images || []).map((url: string) => ({ url })),
          sku: item.sku || `SKU-${crypto.randomUUID()}`,
          quantity: item.quantity || 0,
          categories: item.categories || [],
          currency: item.currency || seller.currency || 'USD',
          region: item.region || region,
          sellerId: seller._id,
          status: 'draft',
          source: 'file',
          sourceId: item.sourceId || `file-${crypto.randomUUID()}`,
          sourceStoreId: item.sourceStoreId || seller._id,
          createdBy: seller._id,
          createdAt: new Date(),
        });
        importedProducts.push(product);
      }
    } else {
      const integration = await Integration.findOne({ _id: provider, type: 'dropshipping', isActive: true });
      if (!integration) {
        await customLogger.error('Integration not found', { requestId, provider, service: 'api' });
        throw new SellerError('INTEGRATION_NOT_FOUND', 'Integration not found');
      }

      const sellerIntegration = await SellerIntegration.findOne({
        sellerId: seller._id,
        integrationId: integration._id,
        isActive: true,
        status: 'connected',
      });
      if (!sellerIntegration) {
        await customLogger.error('Seller integration not connected', { requestId, provider, service: 'api' });
        throw new SellerError('INTEGRATION_NOT_CONNECTED', 'Integration not connected');
      }

      const product = await importService.importProduct(provider, productId, sellerId, region);
      await importService.syncInventory(product.sourceId, sellerId, provider);
      importedProducts.push(product);
    }

    await customLogger.info('Products imported successfully', {
      requestId,
      count: importedProducts.length,
      userId: session.user.id,
      service: 'api',
    });
    return NextResponse.json({
      success: true,
      data: importedProducts,
      requestId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof SellerError ? error.message : String(error);
    await customLogger.error('Failed to import products', { requestId, error: errorMessage, service: 'api' });
    return NextResponse.json(
      { success: false, error: errorMessage, requestId, timestamp: new Date().toISOString() },
      { status: error instanceof SellerError ? error.statusCode : 500 }
    );
  }
}