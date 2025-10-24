import { Metadata } from 'next';
import { getProducts } from '@/lib/actions/seller.actions';
import { auth } from '@/auth';
import ProductList from './product-list';
import { IProduct } from '@/lib/db/models/product.model';
import { redirect } from 'next/navigation';

// تعريف نوع الاستجابة بناءً على مخرجات getProducts
interface ProductsResponse {
  success: boolean;
  message?: string;
  error?: string;
  code?: string;
  data?: {
    products: IProduct[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
}

export const metadata: Metadata = {
  title: 'Products - Seller Dashboard',
  description: 'Manage your products',
};

export default async function ProductsPage() {
  const session = await auth();

  // إذا لم يكن هناك جلسة، إعادة توجيه إلى صفحة تسجيل الدخول
  if (!session?.user?.id) {
    redirect('/auth/login');
  }

  // جلب المنتجات باستخدام معرف البائع
  const response = await getProducts(session.user.id) as ProductsResponse;

  // معالجة حالة الفشل
  if (!response.success || !response.data?.products) {
    return (
      <div className="container py-6">
        <p className="text-red-500">{response.message || response.error || 'Failed to load products'}</p>
      </div>
    );
  }

  return (
    <div className="container py-6">
      <ProductList initialData={response.data.products} />
    </div>
  );
}