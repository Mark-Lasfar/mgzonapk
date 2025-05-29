import { z } from 'zod';
import { SellingPartnerApi } from 'amazon-sp-api';
import { ShopifyAPI } from '@/lib/api/shopify'; // افتراضي، استبدله بمكتبة Shopify الفعلية
import { Product, ProductSchema } from '@/models/product.model';
import { logger } from '@/lib/utils/logger';
import { SellerError } from '@/lib/errors/seller-error';

// تعريف مخطط التحقق للمنتج الخارجي
const externalProductSchema = z.object({
  id: z.string().nonempty('Product ID is required'),
  name: z.string().min(3, 'Product name must be at least 3 characters'),
  description: z.string().optional(),
  price: z.number().positive('Price must be positive'),
  images: z.array(z.string().url('Invalid image URL')),
  source: z.enum(['shopify', 'amazon', 'other']),
  sourceId: z.string().nonempty('Source ID is required'),
  sourceStoreId: z.string().nonempty('Source store ID is required'),
});

export class ProductImportService {
  private amazonConfig = {
    accessKeyId: process.env.AMAZON_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AMAZON_SECRET_ACCESS_KEY!,
    region: 'us-east-1',
  };

  private shopifyConfig = {
    apiKey: process.env.SHOPIFY_API_KEY!,
    password: process.env.SHOPIFY_API_PASSWORD!,
    storeDomain: process.env.SHOPIFY_STORE_DOMAIN!,
  };

  /**
   * Imports a product from Amazon using SP-API.
   * @param asin - The Amazon Standard Identification Number.
   * @param sellerId - The ID of the seller importing the product.
   * @returns The saved product document.
   * @throws SellerError if the import fails.
   */
  async importFromAmazon(asin: string, sellerId: string) {
    try {
      const spApi = new SellingPartnerApi({
        credentials: this.amazonConfig,
        region: this.amazonConfig.region,
      });

      const productData = await spApi.callAPI({
        operation: 'getCatalogItem',
        query: { asin },
      });

      const externalProduct = {
        id: productData.asin,
        name: productData.attributes.item_name[0],
        description: productData.attributes.description?.[0],
        price: productData.attributes.list_price?.amount || 0,
        images: productData.attributes.main_image?.link
          ? [productData.attributes.main_image.link]
          : [],
        source: 'amazon',
        sourceId: productData.asin,
        sourceStoreId: sellerId,
      };

      const validatedProduct = externalProductSchema.parse(externalProduct);

      const product = new Product({
        ...validatedProduct,
        sellerId,
        pricing: { finalPrice: validatedProduct.price },
        status: 'pending',
      });

      await product.save();
      logger.info(`Imported product ${product._id} from Amazon for seller ${sellerId}`);
      return product;
    } catch (error) {
      logger.error(`Failed to import product from Amazon: ${error.message}`);
      throw new SellerError('AMAZON_IMPORT_FAILED', 'Failed to import product from Amazon');
    }
  }

  /**
   * Imports a product from Shopify.
   * @param productId - The Shopify product ID.
   * @param sellerId - The ID of the seller importing the product.
   * @returns The saved product document.
   * @throws SellerError if the import fails.
   */
  async importFromShopify(productId: string, sellerId: string) {
    try {
      const shopify = new ShopifyAPI(this.shopifyConfig);
      const productData = await shopify.getProduct(productId);

      const externalProduct = {
        id: productData.id.toString(),
        name: productData.title,
        description: productData.body_html,
        price: parseFloat(productData.variants[0].price),
        images: productData.images.map((img: any) => img.src),
        source: 'shopify',
        sourceId: productData.id.toString(),
        sourceStoreId: sellerId,
      };

      const validatedProduct = externalProductSchema.parse(externalProduct);

      const product = new Product({
        ...validatedProduct,
        sellerId,
        pricing: { finalPrice: validatedProduct.price },
        status: 'pending',
      });

      await product.save();
      logger.info(`Imported product ${product._id} from Shopify for seller ${sellerId}`);
      return product;
    } catch (error) {
      logger.error(`Failed to import product from Shopify: ${error.message}`);
      throw new SellerError('SHOPIFY_IMPORT_FAILED', 'Failed to import product from Shopify');
    }
  }

  /**
   * Processes payment for an imported product.
   * @param productId - The ID of the imported product.
   * @param sellerId - The ID of the seller.
   * @param paymentDetails - Payment details (e.g., Stripe token).
   * @returns Payment confirmation.
   * @throws SellerError if payment fails.
   */
  async handleImportedProductPayment(
    productId: string,
    sellerId: string,
    paymentDetails: { token: string; amount: number }
  ) {
    try {
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      const charge = await stripe.charges.create({
        amount: paymentDetails.amount * 100, // Stripe expects amount in cents
        currency: 'usd',
        source: paymentDetails.token,
        description: `Payment for imported product ${productId}`,
        metadata: { sellerId, productId },
      });

      logger.info(`Payment processed for product ${productId}: ${charge.id}`);
      return { status: 'success', chargeId: charge.id };
    } catch (error) {
      logger.error(`Payment failed for product ${productId}: ${error.message}`);
      throw new SellerError('PAYMENT_FAILED', 'Failed to process payment');
    }
  }
}