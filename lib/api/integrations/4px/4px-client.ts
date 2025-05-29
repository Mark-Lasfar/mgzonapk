import crypto from 'crypto';
import axios from 'axios';

interface FourPXClientConfig {
  apiKey: string;
  apiSecret: string;
  warehouseId?: string;
}

export class FourPXClient {
  private apiKey: string;
  private apiSecret: string;
  public defaultWarehouse?: string;
  private baseUrl: string;

  constructor(config: FourPXClientConfig) {
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.defaultWarehouse = config.warehouseId;
    this.baseUrl = 'https://openapi.4px.com/api/service'; 
  }

  private generateSignature(content: string, timestamp: string): string {
    const raw = this.apiKey + content + timestamp + this.apiSecret;
    return crypto.createHash('md5').update(raw, 'utf8').digest('hex').toUpperCase();
  }

  private async request<T = any>(serviceCode: string, params: any): Promise<T> {
    const timestamp = Date.now().toString();
    const content = JSON.stringify(params);
    const signature = this.generateSignature(content, timestamp);

    const body = {
      serviceCode,
      requestBody: content,
      sign: signature,
      accessToken: '',
      appKey: this.apiKey,
      timestamp,
      version: '1.0',
      format: 'json',
    };

    const response = await axios.post(this.baseUrl, body, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.data.code !== '0') {
      throw new Error(response.data.msg || '4PX API Error');
    }

    return JSON.parse(response.data.data);
  }

  async createOrder(order: any) {
    return this.request('ORDER_CREATE', order);
  }

  async getOrder(orderId: string) {
    return this.request('ORDER_TRACK', { ref_no: orderId });
  }
}
