// /app/api/seller/integrations/[integrationId]/test/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import Integration from '@/lib/db/models/integration.model';
import SellerIntegration from '@/lib/db/models/seller-integration.model';
import { GenericIntegrationService } from '@/lib/api/services/generic-integration';
import { getTranslations } from 'next-intl/server';

export async function POST(req: NextRequest, { params }: { params: { integrationId: string } }) {
  const t = await getTranslations('seller.integrations');
  try {
    await connectToDatabase(); // إزالة الساندبوكس
    const { storeId, type } = await req.json();
    const { integrationId } = params;

    const integration = await Integration.findById(integrationId);
    if (!integration) {
      return NextResponse.json({ error: t('integration_not_found') }, { status: 404 });
    }

    const sellerIntegration = await SellerIntegration.findOne({ integrationId, sellerId: storeId });
    if (!sellerIntegration) {
      return NextResponse.json({ error: t('not_connected') }, { status: 404 });
    }

    const integrationService = new GenericIntegrationService(integration, sellerIntegration);

    // اختبار مخصص بناءً على نوع التكامل
    switch (integration.type) {
      case 'payment':
        await integrationService.callApi({
          endpoint: integration.settings?.endpoints?.get('test') || '/v1/test',
          method: 'GET',
        });
        break;
      case 'communication':
        if (integration.providerName === 'gmail') {
          await integrationService.callApi({
            endpoint: '/test-email',
            method: 'POST',
            body: { to: 'test@example.com', subject: 'Test Email', html: 'This is a test email' },
          });
        } else if (integration.providerName === 'whatsapp') {
          await integrationService.callApi({
            endpoint: '/messages',
            method: 'POST',
            body: { to: 'test-number', type: 'text', text: { body: 'This is a test message' } },
          });
        }
        break;
      case 'dropshipping':
        if (integration.providerName === 'amazon') {
          await integrationService.callApi({
            endpoint: '/products/test',
            method: 'GET',
          });
        } else if (integration.providerName === 'aliexpress') {
          await integrationService.callApi({
            endpoint: '/api/v1/test-product',
            method: 'GET',
          });
        } else if (integration.providerName === 'shopify') {
          await integrationService.callApi({
            endpoint: '/admin/api/2023-10/products.json',
            method: 'GET',
          });
        }
        break;
      case 'warehouse':
        if (integration.providerName === 'shipbob') {
          await integrationService.callApi({
            endpoint: '/inventory/test',
            method: 'GET',
          });
        } else if (integration.providerName === 'fba') {
          await integrationService.callApi({
            endpoint: '/fba/inventory/test',
            method: 'GET',
          });
        } else if (integration.providerName === 'shipstation') {
          await integrationService.callApi({
            endpoint: '/warehouses/test',
            method: 'GET',
          });
        }
        break;
      case 'advertising':
        if (integration.providerName === 'googleAds') {
          await integrationService.callApi({
            endpoint: '/v12/customers:test',
            method: 'GET',
          });
        }
        break;
      default:
        return NextResponse.json({ error: t('test_not_supported') }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: t(`test_${integration.type}_success`) });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: t('test_failed', { error: errorMessage }) }, { status: 500 });
  }
}