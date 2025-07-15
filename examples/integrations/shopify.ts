import { MGZonAPI } from '@/lib/api/sdk';

export class ShopifyIntegration {
  private mgzonApi: MGZonAPI;
  private shopifyDomain: string;
  private shopifyAccessToken: string;

  constructor(config: {
    mgzonApiKey: string;
    mgzonApiSecret: string;
    shopifyDomain: string;
    shopifyAccessToken: string;
  }) {
    this.mgzonApi = new MGZonAPI({
      baseUrl: 'hager-zon.vercel.app',
      apiKey: config.mgzonApiKey,
      apiSecret: config.mgzonApiSecret,
    });

    this.shopifyDomain = config.shopifyDomain;
    this.shopifyAccessToken = config.shopifyAccessToken;
  }

  private async shopifyRequest(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(
      `https://${this.shopifyDomain}/admin/api/2024-01/${endpoint}`,
      {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': this.shopifyAccessToken,
          ...options.headers,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Shopify API error: ${response.statusText}`);
    }

    return response.json();
  }

  async syncProducts() {
    // Get products from Shopify
    const shopifyProducts = await this.shopifyRequest('products.json');

    // Sync each product to MGZon
    for (const product of shopifyProducts.products) {
      await this.mgzonApi.createProduct({
        name: product.title,
        description: product.body_html,
        price: product.variants[0].price,
        images: product.images.map((img: any) => img.src),
        metadata: {
          shopifyId: product.id,
          vendor: product.vendor,
          productType: product.product_type,
        },
      });
    }
  }

  async syncOrders() {
    // Get orders from MGZon
    const { data } = await this.mgzonApi.getOrders({
      status: 'pending',
    });

    // Create orders in Shopify
    for (const order of data.items) {
      await this.shopifyRequest('orders.json', {
        method: 'POST',
        body: JSON.stringify({
          order: {
            line_items: order.items.map((item: any) => ({
              variant_id: item.metadata?.shopifyVariantId,
              quantity: item.quantity,
            })),
            customer: {
              first_name: order.customer.firstName,
              last_name: order.customer.lastName,
              email: order.customer.email,
            },
            shipping_address: order.shippingAddress,
          },
        }),
      });
    }
  }

  async setupWebhooks() {
    // Create MGZon webhooks for order updates
    await this.mgzonApi.createWebhook({
      url: `https://${this.shopifyDomain}/mgzon-webhook`,
      events: ['order.created', 'order.updated', 'order.fulfilled'],
    });

    // Create Shopify webhooks
    await this.shopifyRequest('webhooks.json', {
      method: 'POST',
      body: JSON.stringify({
        webhook: {
          topic: 'products/create',
          address: 'hager-zon.vercel.app/webhooks/shopify',
          format: 'json',
        },
      }),
    });
  }
}
