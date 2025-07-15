// import { SellingPartnerApi } from 'amazon-sp-api';
// import { customLogger } from '@/lib/api/services/logging';
// import crypto from 'crypto';
// import { z } from 'zod';
// import { ProductImport } from '@/lib/types/product';

// const amazonCredentialsSchema = z.object({
//   region: z.enum(['na', 'eu', 'arabic', 'fe']),
//   credentials: z.object({
//     refreshToken: z.string().nonempty(),
//     clientId: z.string().nonempty(),
//     clientSecret: z.string().nonempty(),
//     awsAccessKey: z.string().nonempty(),
//     awsSecretKey: z.string().nonempty(),
//     roleArn: z.string().nonempty(),
//   }),
// });

// const amazonProductSchema = z.object({
//   productId: z.string().nonempty(),
//   title: z.string().min(3),
//   description: z.string().optional(),
//   price: z.number().positive(),
//   imageUrl: z.string().url().optional(),
//   currency: z.string().default('USD'),
//   sku: z.string().optional(),
//   brand: z.string().optional(),
//   availability: z.enum(['in_stock', 'out_of_stock']).default('in_stock'),
// });

// interface AmazonConfig {
//   region: 'na' | 'eu' | 'arabic' | 'fe';
//   credentials: {
//     refreshToken: string;
//     clientId: string;
//     clientSecret: string;
//     awsAccessKey: string;
//     awsSecretKey: string;
//     roleArn: string;
//   };
// }

// export class AmazonService {
//   private spApi: SellingPartnerApi;
//   private config: z.infer<typeof amazonCredentialsSchema>;

//   private readonly MARKETPLACE_IDS = {
//     na: {
//       us: 'ATVPDKIKX0DER', // الولايات المتحدة
//       ca: 'A2EUQ1WTGCTBG2', // كندا
//       mx: 'A1AM78C64UM0Y8', // المكسيك
//     },
//     eu: {
//       uk: 'A1RKKUPIHCS9HS', // المملكة المتحدة
//       de: 'A1PA6795UKMFR9', // ألمانيا
//       fr: 'A13V1IB3VIYZZH', // فرنسا
//       it: 'APJ6JRA9NG5V4', // إيطاليا
//       es: 'A1RKKUPIHCS9HS', // إسبانيا
//     },
//     arabic: {
//       sa: 'A17E79C6D8S1RJ', // السعودية
//       ae: 'A2VIGQ35RCS4UG', // الإمارات
//       eg: 'ARBP9OOSHTCHU', // مصر
//     },
//     fe: {
//       jp: 'A1VC38T7YXB528', // اليابان
//       au: 'A39IBJ37TRP1C2', // أستراليا
//     },
//   };

//   private readonly CURRENCY_BY_REGION: Record<string, string> = {
//     us: 'USD',
//     ca: 'CAD',
//     mx: 'MXN',
//     uk: 'GBP',
//     de: 'EUR',
//     fr: 'EUR',
//     it: 'EUR',
//     es: 'EUR',
//     sa: 'SAR',
//     ae: 'AED',
//     eg: 'EGP',
//     jp: 'JPY',
//     au: 'AUD',
//   };

//   constructor(config: AmazonConfig) {
//     this.config = amazonCredentialsSchema.parse(config);
//     try {
//       this.spApi = new SellingPartnerApi({
//         region: this.config.region.toLowerCase(),
//         refresh_token: this.config.credentials.refreshToken,
//         credentials: {
//           SELLING_PARTNER_APP_CLIENT_ID: this.config.credentials.clientId,
//           SELLING_PARTNER_APP_CLIENT_SECRET: this.config.credentials.clientSecret,
//           AWS_ACCESS_KEY_ID: this.config.credentials.awsAccessKey,
//           AWS_SECRET_ACCESS_KEY: this.config.credentials.awsSecretKey,
//           AWS_SELLING_PARTNER_ROLE: this.config.credentials.roleArn,
//         },
//       });
//       customLogger.info('Amazon SP-API client initialized', { requestId: crypto.randomUUID(), region: this.config.region, service: 'amazon' });
//     } catch (error) {
//       const requestId = crypto.randomUUID();
//       const errorMessage = error instanceof Error ? error.message : String(error);
//       customLogger.error('Failed to initialize Amazon SP-API client', { requestId, error: errorMessage, service: 'amazon' });
//       throw error;
//     }
//   }

//   private getMarketplaceId(region: string): string {
//     const lowerRegion = region.toLowerCase();
//     const marketplaces = this.MARKETPLACE_IDS;
//     return (
//       marketplaces.na[lowerRegion] ||
//       marketplaces.eu[lowerRegion] ||
//       marketplaces.arabic[lowerRegion] ||
//       marketplaces.fe[lowerRegion] ||
//       marketplaces.na.us // Default to US
//     );
//   }

//   async getProductById(asin: string, region: string = 'us'): Promise<ProductImport | null> {
//     const requestId = crypto.randomUUID();
//     try {
//       const marketplaceId = this.getMarketplaceId(region);
//       const response = await this.spApi.callAPI({
//         operation: 'getCatalogItem',
//         endpoint: 'catalogItems',
//         path: { asin },
//         query: {
//           marketplaceIds: [marketplaceId],
//           includedData: ['attributes', 'images', 'summaries', 'prices'],
//         },
//       });

//       if (!response.Item) {
//         await customLogger.warn('Amazon product not found', { requestId, asin, region, service: 'amazon' });
//         return null;
//       }

//       const item = response.Item;
//       const product = amazonProductSchema.parse({
//         productId: item.ASIN,
//         title: item.Attributes?.item_name?.[0]?.value || '',
//         description: item.Attributes?.feature_bullets?.[0]?.value || '',
//         price: parseFloat(item.Offers?.Listings?.[0]?.Price?.Amount || '0'),
//         imageUrl: item.Images?.Primary?.Large?.URL || '',
//         currency: this.CURRENCY_BY_REGION[region.toLowerCase()] || 'USD',
//         sku: item.Identifiers?.MarketplaceASIN?.ASIN || item.ASIN,
//         brand: item.Attributes?.brand?.[0]?.value || '',
//         availability: item.Offers?.Listings?.[0]?.Availability?.Type?.includes('InStock') ? 'in_stock' : 'out_of_stock',
//       });

//       await customLogger.info('Amazon product fetched successfully', { requestId, asin, productId: product.productId, region, service: 'amazon' });
//       return {
//         ...product,
//         source: 'amazon',
//         sourceId: product.productId,
//         status: 'pending',
//         createdAt: new Date(),
//         updatedAt: new Date(),
//       };
//     } catch (error) {
//       const errorMessage = error instanceof Error ? error.message : String(error);
//       await customLogger.error('Failed to fetch Amazon product', { requestId, asin, error: errorMessage, region, service: 'amazon' });
//       return null;
//     }
//   }

//   async searchProducts(query: string, region: string = 'us', limit: number = 10): Promise<ProductImport[]> {
//     const requestId = crypto.randomUUID();
//     try {
//       const marketplaceId = this.getMarketplaceId(region);
//       const response = await this.spApi.callAPI({
//         operation: 'searchCatalogItems',
//         endpoint: 'catalogItems',
//         query: {
//           keywords: query,
//           marketplaceIds: [marketplaceId],
//           includedData: ['attributes', 'images', 'summaries', 'prices'],
//           pageSize: limit,
//         },
//       });

//       const products = response?.Items?.map((item: any) => {
//         const product = amazonProductSchema.parse({
//           productId: item.ASIN,
//           title: item.Attributes?.item_name?.[0]?.value || '',
//           description: item.Attributes?.feature_bullets?.[0]?.value || '',
//           price: parseFloat(item.Offers?.Listings?.[0]?.Price?.Amount || '0'),
//           imageUrl: item.Images?.Primary?.Large?.URL || '',
//           currency: this.CURRENCY_BY_REGION[region.toLowerCase()] || 'USD',
//           sku: item.Identifiers?.MarketplaceASIN?.ASIN || item.ASIN,
//           brand: item.Attributes?.brand?.[0]?.value || '',
//           availability: item.Offers?.Listings?.[0]?.Availability?.Type?.includes('InStock') ? 'in_stock' : 'out_of_stock',
//         });

//         return {
//           ...product,
//           source: 'amazon',
//           sourceId: product.productId,
//           status: 'pending',
//           createdAt: new Date(),
//           updatedAt: new Date(),
//         };
//       }) || [];

//       await customLogger.info('Amazon products searched successfully', { requestId, query, count: products.length, region, service: 'amazon' });
//       return products;
//     } catch (error) {
//       const errorMessage = error instanceof Error ? error.message : String(error);
//       await customLogger.error('Failed to search Amazon products', { requestId, query, error: errorMessage, region, service: 'amazon' });
//       return [];
//     }
//   }
// }