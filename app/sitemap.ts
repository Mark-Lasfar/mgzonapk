import { MetadataRoute } from 'next'
import { getSetting } from '@/lib/actions/setting.actions'
import Product from '@/lib/db/models/product.model'
import { connectToDatabase } from '@/lib/db'
import { routing } from '@/i18n/routing'

type SitemapEntry = {
  url: string
  lastModified: Date
  changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
  priority: number
}

const STATIC_PAGES: { path: string; priority: number }[] = [
  { path: '', priority: 1.0 },
  { path: '/about-us', priority: 0.7 },
  { path: '/contact-us', priority: 0.7 },
  { path: '/products', priority: 0.8 },
  { path: '/categories', priority: 0.8 },
  { path: '/cart', priority: 0.6 },
  { path: '/checkout', priority: 0.6 },
  { path: '/account', priority: 0.5 },
  { path: '/orders', priority: 0.5 },
  { path: '/wishlist', priority: 0.5 },
  { path: '/privacy-policy', priority: 0.4 },
  { path: '/terms-of-service', priority: 0.4 },
  { path: '/shipping-policy', priority: 0.4 },
  { path: '/return-policy', priority: 0.4 },
  { path: '/faq', priority: 0.4 },
  { path: '/blog', priority: 0.9 },
  { path: '/search', priority: 0.8 },
]

const DEFAULT_BASE_URL = 'https://hager-zon.vercel.app'

const getBaseUrl = (url?: string): string => {
  if (url?.startsWith(DEFAULT_BASE_URL)) {
    return url.replace(/\/+$/, '')
  }
  return DEFAULT_BASE_URL
}

const createStaticRoutes = (baseUrl: string): SitemapEntry[] => {
  const now = new Date()
  return routing.locales.flatMap((locale) =>
    STATIC_PAGES.map(({ path, priority }) => ({
      url: `${baseUrl}/${locale}${path}`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority,
    }))
  )
}

const createProductRoutes = async (baseUrl: string): Promise<SitemapEntry[]> => {
  const products = await Product.find({
    isPublished: true,
    deletedAt: { $exists: false },
  })
    .select('slug updatedAt')
    .lean()

  return products.flatMap((product) =>
    routing.locales.map((locale) => ({
      url: `${baseUrl}/${locale}/product/${product.slug}`,
      lastModified: product.updatedAt || new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    }))
  )
}

// 👇 التصدير الوحيد المسموح به مع Metadata Route
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    await connectToDatabase();
    const { site: { url } } = await getSetting()
    const baseUrl = getBaseUrl(url)

    return [
      ...createStaticRoutes(baseUrl),
      ...(await createProductRoutes(baseUrl)),
    ]
  } catch (error) {
    console.error('Error generating sitemap:', error)
    const fallbackBase = DEFAULT_BASE_URL
    return createStaticRoutes(fallbackBase).map((route) => ({
      ...route,
      priority: Math.max(route.priority - 0.2, 0),
    }))
  }
}

export const revalidate = 3600
