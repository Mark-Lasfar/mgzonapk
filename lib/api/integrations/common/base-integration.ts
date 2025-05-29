import axios, { AxiosRequestConfig } from 'axios';
import { RateLimiter } from 'limiter';
import { CacheManager } from './cache-manager';

interface IntegrationConfig {
  apiKey: string;
  apiSecret?: string;
  apiUrl: string;
  accessToken?: string;
  sandbox?: boolean;
}

export abstract class BaseIntegrationService {
  protected config: IntegrationConfig;
  protected cache: CacheManager;
  protected rateLimiter: RateLimiter;
  protected baseUrl: string;
  protected headers: Record<string, string>;

  constructor(config: IntegrationConfig) {
    this.config = config;
    this.baseUrl = config.sandbox ? `${config.apiUrl}/sandbox` : config.apiUrl;
    this.cache = new CacheManager();
    this.rateLimiter = new RateLimiter({ tokensPerInterval: 100, interval: 'minute' });
    this.headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    };

    if (config.apiSecret) {
      this.headers['X-API-Secret'] = config.apiSecret;
    }
    if (config.accessToken) {
      this.headers['X-Access-Token'] = config.accessToken;
    }
  }

  protected async request<T>(endpoint: string, options: AxiosRequestConfig = {}): Promise<T> {
    await this.rateLimiter.removeTokens(1);

    try {
      const cacheKey = `${endpoint}:${JSON.stringify(options.data)}`;
      const cached = await this.cache.get<T>(cacheKey);
      if (cached) return cached;

      const response = await axios({
        url: `${this.baseUrl}${endpoint}`,
        method: options.method || 'GET',
        headers: { ...this.headers, ...options.headers },
        data: options.data,
        ...options,
      });

      await this.cache.set(cacheKey, response.data, 300); // Cache for 5 minutes
      return response.data;
    } catch (error) {
      console.error(`[${this.constructor.name}] API Error:`, error);
      throw new Error(`API request failed: ${error.message}`);
    }
  }

  abstract createOrder(order: any): Promise<any>;
  abstract getInventoryLevels(productIds?: string[]): Promise<any>;
  abstract getOrder(orderId: string): Promise<any>;
}