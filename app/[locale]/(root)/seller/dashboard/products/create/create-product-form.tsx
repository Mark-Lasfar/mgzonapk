'use client';

const handleError = (error, operation) => {
  console.error(`[${getCurrentDateTime()}] ${operation} failed:`, error);
};

const getCurrentTime = () => {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
};

const logOperation = (operation, details) => {
  console.log(`[${getCurrentTime()}] ${operation}`, details || '');
};

import dynamic from 'next/dynamic';

const ProductForm = dynamic(
  () => import('./product-form'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    ),
  }
);

export default function CreateProductForm() {
  return (
    <div className="bg-card rounded-lg shadow-sm">
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-6">Create New Product</h1>
        <ProductForm type="CreateProductForm" />
      </div>
    </div>
  );
}