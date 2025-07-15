import axios from 'axios';
import { IIntegration } from '@/lib/db/models/integration.model';
import { logger } from '@/lib/api/services/logging';
import { decrypt } from '@/lib/utils/encryption';
import { IOrder } from '@/lib/db/models/order.model';

export interface TaxResult {
  taxAmount: number;
  taxType: 'VAT' | 'GST' | 'SalesTax' | 'none';
  taxRate: number;
  transactionId: string;
}

export class TaxService {
  private integration: IIntegration;
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(integration: IIntegration) {
    this.integration = integration;
    this.baseUrl = integration.baseUrl || '';
    this.headers = {
      'Content-Type': 'application/json',
    };
    if (integration.apiKey) {
      this.headers['Authorization'] = `Bearer ${decrypt(integration.apiKey)}`;
    }
    if (integration.accessToken) {
      this.headers['Authorization'] = `Bearer ${decrypt(integration.accessToken)}`;
    }
  }

  async calculateTax(order: IOrder, integration: IIntegration, currency: string): Promise<TaxResult> {
    try {
      let taxResult: TaxResult;

      switch (integration.providerName) {
        case 'TaxJar':
          taxResult = await this.calculateTaxJar(order, currency);
          break;
        case 'Avalara':
          taxResult = await this.calculateAvalara(order, currency);
          break;
        case 'Quaderno':
          taxResult = await this.calculateQuaderno(order, currency);
          break;
        default:
          throw new Error(`Unsupported tax service: ${integration.providerName}`);
      }

      logger.info('Tax calculated successfully', {
        orderId: order._id,
        provider: integration.providerName,
        taxAmount: taxResult.taxAmount,
      });
      return taxResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Tax calculation failed', {
        orderId: order._id,
        provider: integration.providerName,
        error: errorMessage,
      });
      throw error;
    }
  }

  private async calculateTaxJar(order: IOrder, currency: string): Promise<TaxResult> {
    const response = await axios.post(
      `${this.baseUrl}/v2/taxes`,
      {
        from_country: order.shippingAddress.countryCode,
        to_country: order.shippingAddress.countryCode,
        to_zip: order.shippingAddress.postalCode,
        to_state: order.shippingAddress.state,
        amount: order.totalPrice,
        currency,
      },
      { headers: this.headers }
    );

    return {
      taxAmount: response.data.tax.amount_to_collect || 0,
      taxType: 'SalesTax',
      taxRate: response.data.tax.rate || 0,
      transactionId: response.data.tax.transaction_id || `tx_${Date.now()}`,
    };
  }

  private async calculateAvalara(order: IOrder, currency: string): Promise<TaxResult> {
    const response = await axios.post(
      `${this.baseUrl}/transactions/orders`,
      {
        date: new Date().toISOString(),
        customerCode: order.customerId || 'GUEST',
        addresses: {
          shipTo: {
            country: order.shippingAddress.countryCode,
            postalCode: order.shippingAddress.postalCode,
            region: order.shippingAddress.state,
          },
        },
        lines: order.items.map((item) => ({
          amount: item.price,
          quantity: item.quantity,
        })),
        currencyCode: currency,
      },
      { headers: this.headers }
    );

    return {
      taxAmount: response.data.totalTax || 0,
      taxType: 'SalesTax',
      taxRate: response.data.summary[0]?.rate || 0,
      transactionId: response.data.id || `tx_${Date.now()}`,
    };
  }

  private async calculateQuaderno(order: IOrder, currency: string): Promise<TaxResult> {
    const response = await axios.post(
      `${this.baseUrl}/taxes/calculate`,
      {
        country: order.shippingAddress.countryCode,
        postal_code: order.shippingAddress.postalCode,
        amount: order.totalPrice,
        currency,
      },
      { headers: this.headers }
    );

    return {
      taxAmount: response.data.total_tax_amount || 0,
      taxType: response.data.tax_type || 'VAT',
      taxRate: response.data.rate || 0,
      transactionId: response.data.transaction_id || `tx_${Date.now()}`,
    };
  }
}

export default class TaxServiceFactory {
  static async getService(providerName: string): Promise<TaxService> {
    const Integration = (await import('@/lib/db/models/integration.model')).default;
    const integration = await Integration.findOne({ providerName, type: 'tax', isActive: true }).lean();
    if (!integration) {
      throw new Error(`Tax service ${providerName} not found or inactive`);
    }
    return new TaxService(integration);
  }
}