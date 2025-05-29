export abstract class BaseIntegrationService {
    abstract createProduct(data: any): Promise<any>;
    abstract createOrder(data: any): Promise<any>;
    abstract getOrder(orderId: string): Promise<any>;
    abstract getWarehouses(): Promise<any[]>;
  }