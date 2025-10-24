import { ImportExportService } from '@/lib/services/marketplace/import-export';
import { connectToDatabase } from '@/lib/db';
import Integration from '@/lib/db/models/integration.model';
import SellerIntegration from '@/lib/db/models/seller-integration.model';
import Product from '@/lib/db/models/product.model';
import mongoose from 'mongoose';

describe('ImportExportService', () => {
  beforeAll(async () => {
    await connectToDatabase();
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  it('should import product from API with dynamic integration', async () => {
    const integration = await Integration.create({
      providerName: 'test-provider',
      type: 'marketplace',
      isActive: true,
      settings: {
        apiUrl: 'https://api.test-provider.com',
        authType: 'Bearer',
        endpoints: {
          get: '/products/:id',
          create: '/products',
          sync: '/products/:id/inventory',
        },
        responseMapping: {
          id: 'product_id',
          title: 'name',
          price: 'price',
          quantity: 'stock',
        },
      },
    });

    const sellerIntegration = await SellerIntegration.create({
      sellerId: new mongoose.Types.ObjectId(),
      integrationId: integration._id,
      isActive: true,
      status: 'connected',
      credentials: new Map([['accessToken', 'encrypted-token']]),
    });

    // Mock fetch
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        product_id: '123',
        name: 'Test Product',
        price: '99.99',
        stock: '50',
        images: ['https://test.com/image.jpg'],
      }),
    } as any);

    const service = new ImportExportService();
    const result = await service.importProducts('test-provider', sellerIntegration.sellerId.toString(), {
      source: 'api',
      productId: '123',
    });

    expect(result.success).toBe(true);
    expect(result.products).toHaveLength(1);
    expect(result.products[0]).toMatchObject({
      title: 'Test Product',
      price: 99.99,
      quantity: 50,
      sourceId: '123',
    });
  });
});