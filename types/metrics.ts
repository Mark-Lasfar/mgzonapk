export interface Metrics {
    rating: number;
    totalSales: { amount: number; date: Date }[];
    totalRevenue: number;
    productsCount: number;
    ordersCount: number;
    customersCount: number;
    views: { date: Date }[];
    followers: number;
    ratingsCount: number;
    products: {
      total: number;
      active: number;
      outOfStock: number;
    };
  }
  
  export interface MetricsFilter {
    startDate?: string;
    endDate?: string;
    metricType?: 'sales' | 'views' | 'ratings' | 'all';
  }