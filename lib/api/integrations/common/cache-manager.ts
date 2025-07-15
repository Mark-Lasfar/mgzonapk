export class CacheManager {
  private cache: Map<string, { data: unknown; expiry: number }>; // Changed from 'any' to 'unknown'
  
    constructor() {
      this.cache = new Map();
    }
  
    async get<T>(key: string): Promise<T | null> {
      const item = this.cache.get(key);
      if (!item) return null;
      if (Date.now() > item.expiry) {
        this.cache.delete(key);
        return null;
      }
      return item.data as T;
    }
  
    async set<T>(key: string, data: T, ttlSeconds: number): Promise<void> {
      this.cache.set(key, {
        data,
        expiry: Date.now() + ttlSeconds * 1000,
      });
    }
  
    async clear(key: string): Promise<void> {
      this.cache.delete(key);
    }
  }