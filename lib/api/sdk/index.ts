export class MGZonAPI {
  private baseUrl: string;
  private apiKey: string;
  private apiSecret: string;

  constructor(config: {
    baseUrl: string;
    apiKey: string;
    apiSecret: string;
  }) {
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
  }

  private async request(
    endpoint: string,
    options: RequestInit = {}
  ) {
    const timestamp = new Date().toISOString();
    const signature = this.generateSignature(timestamp);

    const response = await fetch(`${this.baseUrl}/api/v1/${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'x-api-secret': this.apiSecret,
        'x-timestamp': timestamp,
        'x-signature': signature,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'API request failed');
    }

    return response.json();
  }

  private generateSignature(timestamp: string): string {
    const crypto = require('crypto');
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(`${this.apiKey}${timestamp}`)
      .digest('hex');
  }

  // Products API
  async getProducts(params: {
    page?: number;
    limit?: number;
    category?: string;
    search?: string;
    sort?: string;
  } = {}) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) searchParams.append(key, value.toString());
    });

    return this.request(`products?${searchParams.toString()}`);
  }

  async createProduct(data: any) {
    return this.request('products', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProduct(id: string, data: any) {
    return this.request(`products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteProduct(id: string) {
    return this.request(`products/${id}`, {
      method: 'DELETE',
    });
  }

  // Orders API
  async getOrders(params: {
    page?: number;
    limit?: number;
    status?: string;
    from?: string;
    to?: string;
  } = {}) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) searchParams.append(key, value.toString());
    });

    return this.request(`orders?${searchParams.toString()}`);
  }

  async createOrder(data: any) {
    return this.request('orders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateOrder(id: string, data: any) {
    return this.request(`orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Webhooks API
  async createWebhook(data: {
    url: string;
    events: string[];
  }) {
    return this.request('webhooks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getWebhooks() {
    return this.request('webhooks');
  }

  async deleteWebhook(id: string) {
    return this.request(`webhooks/${id}`, {
      method: 'DELETE',
    });
  }
}