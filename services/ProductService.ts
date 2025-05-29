// services/ProductService.ts
export class ProductService {
    static async createProduct(data: any) {
      const res = await fetch('/api/products', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return res.json();
    }
  }