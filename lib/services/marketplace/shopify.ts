import axios from 'axios';
import { createCSV, parseCSV } from '@/lib/utils/csv';
import { parseXML } from '@/lib/utils/xml';
import { logger } from '../logging';
import {
  MarketplaceProduct,
  ProductImage,
  ProductVariant,
  ProductOption,
  ImportOptions,
  ImportResult,
  ImportError,
  ImportWarning,
  ExportOptions,
  ExportResult,
  MarketplaceConfig,
  SyncOptions,
  SyncResult,
  SyncConflict,
  AnalyticsData,
  TransformationRule,
  BackupMetadata,
  MarketplaceOrder,
  ShopifyProductResponse,
  ShopifyOrderResponse
} from './types';
// import { logger } from '@/lib/utils/logger';

const SHOPIFY_API_URL = process.env.SHOPIFY_API_URL!;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN!;

const http = axios.create({
  baseURL: SHOPIFY_API_URL,
  headers: {
    'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
    'Content-Type': 'application/json',
  },
});

export const shopifyConfig: MarketplaceConfig = {
  name: 'Shopify',
  supportsImport: true,
  supportsExport: true,
  supportsSync: true,
  supportsAnalytics: true,
};

export async function fetchProducts(): Promise<MarketplaceProduct[]> {
  try {
    const res = await http.get<ShopifyProductResponse>('/products.json');

    return res.data.products.map(product => {
      const variants: ProductVariant[] = product.variants.map(v => ({
        id: v.id.toString(),
        sku: v.sku,
        price: parseFloat(v.price),
        quantity: v.inventory_quantity,
      }));

      const images: ProductImage[] = product.images.map(i => ({
        url: i.src,
        alt: i.alt || '',
      }));

      return {
        id: product.id.toString(),
        title: product.title,
        description: product.body_html,
        price: parseFloat(product.variants[0]?.price || '0'),
        quantity: product.variants[0]?.inventory_quantity || 0,
        images,
        variants,
        options: product.options.map(o => ({
          name: o.name,
          values: o.values,
        })) as ProductOption[],
      };
    });
  } catch (err) {
    logger.error('Error fetching Shopify products', err);
    return [];
  }
}

export async function fetchOrders(): Promise<MarketplaceOrder[]> {
  try {
    const res = await http.get<ShopifyOrderResponse>('/orders.json');

    return res.data.orders.map(order => ({
      id: order.id.toString(),
      status: order.financial_status,
      total: parseFloat(order.total_price),
      createdAt: new Date(order.created_at),
      customer: {
        name: `${order.customer.first_name} ${order.customer.last_name}`,
        email: order.customer.email,
      },
      items: order.line_items.map(item => ({
        productId: item.product_id.toString(),
        quantity: item.quantity,
        price: parseFloat(item.price),
      })),
    }));
  } catch (err) {
    logger.error('Error fetching Shopify orders', err);
    return [];
  }
}

export async function importProducts(options: ImportOptions): Promise<ImportResult> {
  try {
    const data = options.format === 'csv'
      ? await parseCSV(options.file)
      : await parseXML(options.file);

    const imported = data.length;
    const warnings: ImportWarning[] = [];

    return {
      success: true,
      imported,
      warnings,
    };
  } catch (err) {
    logger.error('Import failed', err);
    const errors: ImportError[] = [{
      message: 'Failed to parse file.',
      line: 0,
    }];
    return {
      success: false,
      imported: 0,
      errors,
    };
  }
}

export async function exportProducts(options: ExportOptions): Promise<ExportResult> {
  try {
    const products = await fetchProducts();
    const csv = createCSV(products);

    return {
      success: true,
      file: csv,
    };
  } catch (err) {
    logger.error('Export failed', err);
    return {
      success: false,
      error: 'Failed to export products.',
    };
  }
}

export async function syncData(options: SyncOptions): Promise<SyncResult> {
  try {
    const remote = await fetchProducts();
    const local = options.localProducts || [];

    const conflicts: SyncConflict[] = [];

    local.forEach(localProduct => {
      const matchingRemote = remote.find(r => r.id === localProduct.id);
      if (matchingRemote && matchingRemote.price !== localProduct.price) {
        conflicts.push({
          productId: localProduct.id,
          field: 'price',
          localValue: localProduct.price,
          remoteValue: matchingRemote.price,
        });
      }
    });

    return {
      success: true,
      updated: remote.length,
      conflicts,
    };
  } catch (err) {
    logger.error('Sync error', err);
    return {
      success: false,
      updated: 0,
      conflicts: [],
    };
  }
}

export async function analyzeSales(): Promise<AnalyticsData> {
  const orders = await fetchOrders();
  const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);

  return {
    totalOrders: orders.length,
    totalRevenue,
    topProducts: [], // Optional: fill later with bestsellers logic
  };
}

export async function applyTransformationRules(
  products: MarketplaceProduct[],
  rules: TransformationRule[]
): Promise<MarketplaceProduct[]> {
  return products.map(product => {
    let newPrice = product.price;

    rules.forEach(rule => {
      if (rule.type === 'markup') {
        newPrice += newPrice * (rule.value / 100);
      } else if (rule.type === 'discount') {
        newPrice -= newPrice * (rule.value / 100);
      }
    });

    return {
      ...product,
      price: parseFloat(newPrice.toFixed(2)),
    };
  });
}

export async function getBackupMetadata(): Promise<BackupMetadata> {
  const products = await fetchProducts();

  return {
    source: 'shopify',
    timestamp: new Date().toISOString(),
    itemCount: products.length,
  };
}
