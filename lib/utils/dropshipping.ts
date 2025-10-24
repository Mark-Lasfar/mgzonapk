import { cache } from 'react';
import { SellerError } from '@/lib/errors/seller-error';
import { DynamicIntegrationService } from '@/lib/services/integrations';
import Integration from '@/lib/db/models/integration.model';
import SellerIntegration from '@/lib/db/models/seller-integration.model';
import { connectToDatabase } from '@/lib/db';

interface DropshippingProduct {
  name: string;
  description: string;
  price: number;
  images: string[];
  sku: string;
  currency: string;
  availability: 'in_stock' | 'out_of_stock';
  region?: string;
}

const cachedFetchDropshippingProduct = cache(async (
  providerId: string,
  externalProductId: string,
  sellerId: string
): Promise<DropshippingProduct> => {
  try {
    await connectToDatabase();
    const integration = await Integration.findById(providerId);
    if (!integration || integration.type !== 'dropshipping') {
      throw new SellerError('INVALID_PROVIDER', 'Invalid or non-dropshipping provider');
    }

    const sellerIntegration = await SellerIntegration.findOne({
      integrationId: providerId,
      sellerId,
      isActive: true,
      status: 'connected',
    });

    if (!sellerIntegration) {
      throw new SellerError('INTEGRATION_NOT_CONNECTED', 'Integration not connected');
    }

    const integrationService = new DynamicIntegrationService(
      {
        _id: integration._id.toString(),
        type: integration.type,
        status: sellerIntegration.status,
        providerName: integration.providerName,
        settings: integration.settings,
        logoUrl: integration.logoUrl,
        webhook: sellerIntegration.webhook,
      },
      sellerIntegration
    );

    const product = await integrationService.importProduct(externalProductId, sellerId);
    // Ensure sku is a string by providing a default if undefined
    return {
      ...product,
      sku: product.sku || `default-sku-${externalProductId}`,
    };
  } catch (error: unknown) {
    // Type guard to safely access error.message
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    throw error instanceof SellerError
      ? error
      : new SellerError('FETCH_FAILED', `Failed to fetch dropshipping product: ${errorMessage}`);
  }
});

export async function fetchDropshippingProduct(
  providerId: string,
  externalProductId: string,
  sellerId: string
): Promise<DropshippingProduct> {
  return cachedFetchDropshippingProduct(providerId, externalProductId, sellerId);
}