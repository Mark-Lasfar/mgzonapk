// /home/hager/new/my-nextjs-project-master (3)/my-nextjs-project-master/lib/api/services/marketplace/import-export.ts

import { customLogger } from '@/lib/api/services/logging';
import crypto from 'crypto';
import { GenericIntegrationService } from '@/lib/api/services/generic-integration';
import Integration from '@/lib/db/models/integration.model';
import SellerIntegration from '@/lib/db/models/seller-integration.model';
import { ImportOptions, ExportOptions, ImportResult, ExportResult } from '@/lib/types/marketplace';

export class ImportExportService {
  private async getIntegrationService(platform: string, sellerId: string, region: string) {
    const requestId = crypto.randomUUID();
    try {
      const integration = await Integration.findOne({ providerName: platform, type: 'marketplace', isActive: true });
      if (!integration) {
        throw new Error(`Integration not found for platform: ${platform}`);
      }

      const sellerIntegration = await SellerIntegration.findOne({
        sellerId,
        integrationId: integration._id,
        isActive: true,
      });
      if (!sellerIntegration) {
        throw new Error(`Seller not connected to ${platform}`);
      }

      return new GenericIntegrationService(integration, sellerIntegration);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await customLogger.error('Failed to initialize integration', { requestId, platform, sellerId, region, error: errorMessage, service: 'import-export' });
      throw error;
    }
  }

  async importProducts(platform: string, sellerId: string, options: ImportOptions & { region?: string }): Promise<ImportResult> {
    const requestId = crypto.randomUUID();
    try {
      const service = await this.getIntegrationService(platform, sellerId, options.region || 'us');
      const endpoint = (await Integration.findOne({ providerName: platform }))?.settings.endpoints?.importProducts || `/products/import`;
      const result = await service.callApi({
        endpoint,
        method: 'POST',
        body: options,
      });

      await customLogger.info('Products imported successfully', {
        requestId,
        platform,
        count: result.stats.imported,
        region: options.region || 'us',
        service: 'import-export',
      });
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await customLogger.error('Failed to import products', {
        requestId,
        platform,
        error: errorMessage,
        region: options.region || 'us',
        service: 'import-export',
      });
      throw new Error(`Import failed: ${errorMessage}`);
    }
  }

  async exportProducts(platform: string, sellerId: string, products: any[], options: ExportOptions & { region?: string }): Promise<ExportResult> {
    const requestId = crypto.randomUUID();
    try {
      const service = await this.getIntegrationService(platform, sellerId, options.region || 'us');
      const endpoint = (await Integration.findOne({ providerName: platform }))?.settings.endpoints?.exportProducts || `/products/export`;
      const result = await service.callApi({
        endpoint,
        method: 'POST',
        body: { products, ...options },
      });

      await customLogger.info('Products exported successfully', {
        requestId,
        platform,
        count: result.stats.exported,
        region: options.region || 'us',
        service: 'import-export',
      });
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await customLogger.error('Failed to export products', {
        requestId,
        platform,
        error: errorMessage,
        region: options.region || 'us',
        service: 'import-export',
      });
      throw new Error(`Export failed: ${errorMessage}`);
    }
  }
}