import { Metadata } from 'next'
import { auth } from '@/auth'

export const metadata: Metadata = {
  title: 'Analytics - Seller Dashboard',
  description: 'View your sales analytics and performance metrics'
}

export default async function AnalyticsPage() {
  const session = await auth()
  
  if (!session?.user?.id) {
    return null // Handle in layout
  }

  return (
    <div className="container py-6 space-y-6">
      <h1 className="text-2xl font-bold">Analytics</h1>
      
      <div className="grid gap-4 md:grid-cols-3">
        {/* Example Analytics Cards */}
        <div className="p-4 border rounded-lg">
          <h3 className="text-sm font-medium text-muted-foreground">Total Sales</h3>
          <p className="text-2xl font-bold">$0.00</p>
        </div>
        
        <div className="p-4 border rounded-lg">
          <h3 className="text-sm font-medium text-muted-foreground">Orders</h3>
          <p className="text-2xl font-bold">0</p>
        </div>
        
        <div className="p-4 border rounded-lg">
          <h3 className="text-sm font-medium text-muted-foreground">Products</h3>
          <p className="text-2xl font-bold">0</p>
        </div>
      </div>

      <div className="border rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-4">Sales Overview</h2>
        <p className="text-muted-foreground">No data available yet.</p>
      </div>
    </div>
  )
}