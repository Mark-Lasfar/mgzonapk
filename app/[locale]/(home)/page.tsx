import { Suspense } from 'react'
import BrowsingHistoryList from '@/components/shared/browsing-history-list'
import { HomeCard } from '@/components/shared/home/home-card'
import { HomeCarousel } from '@/components/shared/home/home-carousel'
import ProductSlider from '@/components/shared/product/product-slider'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  getProductsForCard,
  getProductsByTag,
  getProductCategories,
} from '@/lib/actions/product.actions'
import { getSetting } from '@/lib/actions/setting.actions'
import { getTranslations } from 'next-intl/server'

// Types
interface ProductBase {
  _id: string
  name: string
  images: string[]
  slug: string
  price: number
  finalPrice?: number
  description?: string
  category?: string
  tags?: string[]
  metrics?: {
    rating: number
    sales: number
  }
}

interface CardItem {
  name: string
  image: string
  href: string
  badge?: string
  price?: number
  rating?: number
}

interface CardSection {
  title: string
  items: CardItem[]
  link: {
    text: string
    href: string
  }
  layout?: 'grid' | 'carousel'
}

// Helper Functions
function mapProductToCardItem(product: ProductBase): CardItem {
  return {
    name: product.name,
    image: Array.isArray(product.images) && product.images.length > 0
      ? product.images[0]
      : '/images/fallback.jpg',
    href: `/product/${product.slug}`,
    price: product.finalPrice || product.price,
    rating: product.metrics?.rating,
    badge: getBadgeForProduct(product)
  }
}

function mapCategoryToCardItem(category: any): CardItem {
  return {
    name: category.name,
    image: category.image || '/images/fallback.jpg',
    href: `/search?category=${encodeURIComponent(category.name)}`,
    badge: `${category.productCount || 0} Products`
  }
}

function getBadgeForProduct(product: ProductBase): string | undefined {
  if (product.metrics?.sales && product.metrics.sales > 100) {
    return 'Best Seller'
  }
  if (product.tags?.includes('new-arrival')) {
    return 'New'
  }
  if (product.tags?.includes('sale')) {
    return 'Sale'
  }
  return undefined
}

async function fetchProductsByTag(tag: string, limit = 4) {
  try {
    const products = await getProductsForCard({ tag, limit })
    return products.map(mapProductToCardItem)
  } catch (error) {
    console.error(`Error fetching products for tag ${tag}:`, error)
    return []
  }
}

// Loading Components
function CardSectionSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-1/3" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-48 w-full rounded-lg" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  )
}

function ProductSliderSkeleton() {
  return (
    <Card className="w-full rounded-none">
      <CardContent className="p-4">
        <Skeleton className="h-8 w-1/4 mb-4" />
        <div className="flex gap-4 overflow-hidden">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="w-48 flex-shrink-0 space-y-3">
              <Skeleton className="h-48 w-full rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Main Component
export default async function HomePage() {
  const t = await getTranslations('Home')
  
  // Get settings first
  const settings = await getSetting()
  const featuredCategoriesCount = settings.common?.featuredCategories || 4
  
  // Fetch all data in parallel
  const [
    todaysDeals,
    bestSellingProducts,
    categories,
    newArrivals,
    featureds,
    bestSellers,
    flashDeals,
  ] = await Promise.all([
    getProductsByTag({ tag: 'todays-deal', limit: 8 }),
    getProductsByTag({ tag: 'best-seller', limit: 8 }),
    getProductCategories(featuredCategoriesCount),
    fetchProductsByTag('new-arrival', 4),
    fetchProductsByTag('featured', 4),
    fetchProductsByTag('best-seller', 4),
    fetchProductsByTag('flash-sale', 4),
  ])

  const carousels = settings.carousels || []

  // Map categories to card items
  const categoryCards = categories.map(mapCategoryToCardItem)

  // Define card sections
  const cards: CardSection[] = [
    {
      title: t('Categories to explore'),
      link: {
        text: t('See More'),
        href: '/search',
      },
      items: categoryCards,
      layout: 'grid'
    },
    {
      title: t('Explore New Arrivals'),
      items: newArrivals,
      link: {
        text: t('View All'),
        href: '/search?tag=new-arrival',
      },
      layout: 'carousel'
    },
    {
      title: t('Flash Deals'),
      items: flashDeals,
      link: {
        text: t('Shop Now'),
        href: '/search?tag=flash-sale',
      },
      layout: 'grid'
    },
    {
      title: t('Discover Best Sellers'),
      items: bestSellers,
      link: {
        text: t('View All'),
        href: '/search?tag=best-seller',
      },
      layout: 'carousel'
    },
    {
      title: t('Featured Products'),
      items: featureds,
      link: {
        text: t('Shop Now'),
        href: '/search?tag=featured',
      },
      layout: 'grid'
    },
  ]

  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="relative">
        <Suspense fallback={<Skeleton className="h-[400px] w-full" />}>
          <HomeCarousel items={carousels} />
        </Suspense>
      </section>

      {/* Main Content */}
      <div className="md:p-4 md:space-y-4 bg-border">
        {/* Categories and Featured Sections */}
        <Suspense fallback={<CardSectionSkeleton />}>
          <HomeCard cards={cards} />
        </Suspense>

        {/* Today's Deals */}
        <Suspense fallback={<ProductSliderSkeleton />}>
          <Card className="w-full rounded-none">
            <CardContent className="p-4 items-center gap-3">
              <ProductSlider 
                title={t("Today's Deals")} 
                products={todaysDeals}
                viewAll="/search?tag=todays-deal"
              />
            </CardContent>
          </Card>
        </Suspense>

        {/* Best Selling Products */}
        <Suspense fallback={<ProductSliderSkeleton />}>
          <Card className="w-full rounded-none">
            <CardContent className="p-4 items-center gap-3">
              <ProductSlider
                title={t('Best Selling Products')}
                products={bestSellingProducts}
                viewAll="/search?tag=best-seller"
                hideDetails
              />
            </CardContent>
          </Card>
        </Suspense>
      </div>

      {/* Browsing History */}
      <div className="p-4 bg-background">
        <Suspense fallback={<CardSectionSkeleton />}>
          <BrowsingHistoryList />
        </Suspense>
      </div>
    </main>
  )
}

// Metadata
export const metadata = {
  title: 'Home | MGZon',
  description: 'Discover amazing products at great prices',
  keywords: 'online shopping, e-commerce, deals, best sellers, new arrivals',
}

// Cache and revalidation
export const revalidate = 3600 // Revalidate every hour

// Generate static params
export async function generateStaticParams() {
  return [{ locale: 'en' }, { locale: 'ar' }]
}

// Optimize images
export const images = {
  domains: ['res.cloudinary.com', 'hager-zon.vercel.app'],
  deviceSizes: [640, 750, 828, 1080, 1200, 1920],
  imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  formats: ['image/webp'],
}