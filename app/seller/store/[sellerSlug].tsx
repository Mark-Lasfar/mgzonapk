'use client'
import { useEffect, useState } from 'react'
import axios from 'axios'
import { ProductCard } from '@/components/ui/product-card'

export default function VendorStore({ params }: { params: { sellerSlug: string } }) {
  const [products, setProducts] = useState([])

  useEffect(() => {
    async function fetchProducts() {
      try {
        const res = await axios.get(`/api/seller/products?seller=${params.sellerSlug}`)
        setProducts(res.data.products)
      } catch (error) {
        console.error("Error fetching seller products", error)
      }
    }
    fetchProducts()
  }, [params.sellerSlug])

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold">Store: {params.sellerSlug}</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
        {products.map((product: any) => (
          <ProductCard key={product._id} product={product} />
        ))}
      </div>
    </div>
  )
}
