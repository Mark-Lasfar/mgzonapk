const handleError = (error, operation) => {
  console.error(`[${getCurrentDateTime()}] ${operation} failed:`, error);
};

const getCurrentDateTime = () => {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
};

const logOperation = (operation, details) => {
  console.log(`[${getCurrentDateTime()}] ${operation}`, details || '');
};

import Link from 'next/link'
import { Metadata } from 'next'
import CreateProductForm from './create-product-form'

export const metadata: Metadata = {
  title: 'Create Product - Seller Dashboard',
  description: 'Create a new product in your seller dashboard',
}

export default function CreateProductPage() {
  return (
    <main className="max-w-6xl mx-auto p-4">
      <div className="flex items-center gap-2 mb-8">
        <Link
          href="/seller/dashboard/products"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          Products
        </Link>
        <span className="text-muted-foreground">›</span>
        <span className="font-medium">Create New Product</span>
      </div>

      <CreateProductForm />
    </main>
  )
}