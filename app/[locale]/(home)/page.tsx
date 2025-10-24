// /app/[locale]/(home)/page.tsx
import { Suspense } from 'react';
import { getLocale } from 'next-intl/server';
import { Metadata } from 'next';
import BrowsingHistoryList from '@/components/shared/browsing-history-list';
import { HomeCard } from '@/components/shared/home/home-card';
import { HomeCarousel } from '@/components/shared/home/home-carousel';
import ProductSlider from '@/components/shared/product/product-slider';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { trackProductView } from '@/lib/actions/product.actions';
import {
  getProductsByTag,
  getProductCategories,
  getLatestProducts,
  getAllProducts,
  getAllTags,
  getAllCategories,
  getRelatedProducts,
  getProductStats,
  getSellerProducts,
  IProduct,
} from '@/lib/actions/product.actions';
import { getWarehouses } from '@/lib/actions/warehouse.actions';
import { getSetting } from '@/lib/actions/setting.actions';
import { getTranslations } from 'next-intl/server';
import { logger } from '@/lib/services/logging';
import Script from 'next/script';

// Types
interface CardItem {
  name: string;
  image: string;
  href: string;
  badge?: string;
  offerEndTime?: string;
  price?: number;
  rating?: number;
}

interface CardSection {
  title: string;
  items: CardItem[];
  link: { text: string; href: string };
  layout?: 'grid' | 'carousel';
}

// Helper Functions
function mapProductToCardItem(product: IProduct): CardItem {
  return {
    name: product.name,
    image: Array.isArray(product.images) && product.images.length > 0
      ? product.images[0]
      : '/images/fallback.jpg',
    href: `/product/${product.slug}`,
    price: product.pricing?.finalPrice ?? product.price,
    rating: product.avgRating,
    badge: getBadgeForProduct(product),
    offerEndTime: product.tags?.includes('flash-sale')
      ? product.offerEndTime || new Date(Date.now() + Math.random() * 24 * 60 * 60 * 1000).toISOString()
      : undefined,
  };
}

function mapCategoryToCardItem(category: { name: string; image?: string; productCount: number }): CardItem {
  return {
    name: category.name,
    image: category.image ?? '/images/category-placeholder.jpg',
    href: `/search?category=${encodeURIComponent(category.name)}`,
    badge: `${category.productCount} ${category.productCount === 1 ? 'Product' : 'Products'}`,
  };
}

function mapSimpleCategoryToCardItem(category: string): CardItem {
  return {
    name: category,
    image: '/images/category-placeholder.jpg',
    href: `/search?category=${encodeURIComponent(category)}`,
  };
}

function mapTagToCardItem(tag: string): CardItem {
  return {
    name: tag,
    image: '/images/tags-placeholder.jpg',
    href: `/search?tag=${encodeURIComponent(tag)}`,
  };
}

function getBadgeForProduct(product: IProduct): string | undefined {
  if (product.metrics?.sales && product.metrics.sales > 100) {
    return 'Best Seller';
  }
  if (product.tags?.includes('new-arrival')) {
    return 'New';
  }
  if (product.tags?.includes('sale') || product.tags?.includes('flash-sale')) {
    return 'Sale';
  }
  if (product.tags?.includes('todays-deal')) {
    return "Today's Deal";
  }
  if (product.warehouseData?.some((w: { warehouseId: string; quantity: number; sku: string }) => w.quantity > 0)) {
    return 'In Stock';
  }
  return undefined;
}

async function fetchProductsByTag(tag: string, limit = 4): Promise<{ items: CardItem[], products: IProduct[] }> {
  try {
    const products = await getProductsByTag({ tag, limit, sortBy: 'relevance' });
    return {
      items: products.map(mapProductToCardItem),
      products,
    };
  } catch (error) {
    logger.error(`Error fetching products for tag ${tag}`, error);
    return { items: [], products: [] };
  }
}

async function fetchLatestProducts(limit = 4): Promise<{ items: CardItem[], products: IProduct[] }> {
  try {
    const products = await getLatestProducts({ limit });
    return {
      items: products.map(mapProductToCardItem),
      products,
    };
  } catch (error) {
    logger.error('Error fetching latest products', error);
    return { items: [], products: [] };
  }
}

async function fetchTopRatedProducts(limit = 4): Promise<{ items: CardItem[], products: IProduct[] }> {
  try {
    const products = await getAllProducts({ rating: 4, limit, sort: 'avg-customer-review' });
    return {
      items: products.products.map(mapProductToCardItem),
      products: products.products,
    };
  } catch (error) {
    logger.error('Error fetching top rated products', error);
    return { items: [], products: [] };
  }
}

async function fetchPopularTags(limit = 6): Promise<CardItem[]> {
  try {
    const tags = await getAllTags();
    return tags.slice(0, limit).map(mapTagToCardItem);
  } catch (error) {
    logger.error('Error fetching popular tags', error);
    return [];
  }
}

async function fetchTrendingCategories(limit = 4): Promise<CardItem[]> {
  try {
    const categories = await getProductCategories(limit);
    return categories.map(mapCategoryToCardItem);
  } catch (error) {
    logger.error('Error fetching trending categories', error);
    return [];
  }
}

async function fetchAllCategories(limit = 8): Promise<CardItem[]> {
  try {
    const categories = await getAllCategories();
    return categories.slice(0, limit).map(mapSimpleCategoryToCardItem);
  } catch (error) {
    logger.error('Error fetching all categories', error);
    return [];
  }
}

async function fetchTrendingProducts(limit = 4): Promise<{ items: CardItem[], products: IProduct[] }> {
  try {
    const stats = await getProductStats({ startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) });
    const sortOption = stats.data?.totalSales > stats.data?.totalViews ? 'best-selling' : 'views-desc';
    const products = await getAllProducts({ limit, sort: sortOption as any });
    return {
      items: products.products.map(mapProductToCardItem),
      products: products.products,
    };
  } catch (error) {
    logger.error('Error fetching trending products', error);
    return { items: [], products: [] };
  }
}

async function fetchRelatedProducts(category: string, limit = 4): Promise<{ items: CardItem[], products: IProduct[] }> {
  try {
    const products = await getRelatedProducts({ category, limit });
    return {
      items: products.map(mapProductToCardItem),
      products,
    };
  } catch (error) {
    logger.error(`Error fetching related products for category ${category}`, error);
    return { items: [], products: [] };
  }
}

async function fetchAvailableProducts(limit = 4): Promise<{ items: CardItem[], products: IProduct[] }> {
  try {
    const warehouses = await getWarehouses('en');
    const warehouseIds = warehouses.data.map(w => w._id);
    const products = await getAllProducts({ limit });
    const availableProducts = products.products.filter(p =>
      p.warehouseData?.some((w: { warehouseId: string; quantity: number; sku: string }) => 
        warehouseIds.includes(w.warehouseId) && w.quantity > 0
      )
    );
    return {
      items: availableProducts.map(mapProductToCardItem),
      products: availableProducts,
    };
  } catch (error) {
    logger.error('Error fetching available products', error);
    return { items: [], products: [] };
  }
}

async function fetchSellerSpotlight(sellerId: string, limit = 4): Promise<{ items: CardItem[], products: IProduct[] }> {
  try {
    const result = await getSellerProducts({ sellerId, limit });
    return {
      items: result.products.map(mapProductToCardItem),
      products: result.products,
    };
  } catch (error) {
    logger.error(`Error fetching seller spotlight products for seller ${sellerId}`, error);
    return { items: [], products: [] };
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
  );
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
  );
}

function ErrorFallback({ title }: { title: string }) {
  return (
    <Card className="w-full rounded-none">
      <CardContent className="p-4">
        <p className="text-red-500">{title}: Unable to load products. Please try again later.</p>
      </CardContent>
    </Card>
  );
}

// Metadata
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Home');
  const settings = await getSetting();
  const baseUrl = settings.site?.url || 'https://hager-zon.vercel.app';

  const keywords = [
    'mgzon',
    'ecommerce',
    'online shopping',
    'marketplace',
    'best deals',
    'secure shopping',
    'fast delivery',
    ...(settings.seo?.keywords?.split(', ') || []),
  ];

  return {
    title: `${settings.seo?.metaTitle || t('Home')} | ${settings.site?.name || 'MGZon'}`,
    description: settings.seo?.metaDescription || t('MetaDescription'),
    keywords: keywords.join(', '),
    openGraph: {
      title: settings.seo?.metaTitle || t('Home'),
      description: settings.seo?.metaDescription || t('MetaDescription'),
      images: [{ url: settings.seo?.ogImage || `${baseUrl}/icons/og-image.jpg`, alt: settings.site?.name || 'MGZon' }],
      url: baseUrl,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: settings.seo?.metaTitle || t('Home'),
      description: settings.seo?.metaDescription || t('MetaDescription'),
      images: [settings.seo?.ogImage || `${baseUrl}/icons/og-image.jpg`],
    },
  };
}

// Main Component
export default async function HomePage() {
  const t = await getTranslations('Home');
  const locale = await getLocale();
  const settings = await getSetting();
  const featuredCategoriesCount = settings.common?.featuredCategories?.length ?? 4;
  const featuredSellerId = settings.featuredSellerId ?? 'default-seller-id';

  // Fetch categories first to use in related products
  const categories = await getProductCategories(featuredCategoriesCount);

  // Fetch all data in parallel
  const [
    todaysDeals,
    bestSellingProducts,
    newArrivals,
    featuredProducts,
    flashDeals,
    latestProducts,
    topRatedProducts,
    popularTags,
    allCategories,
    trendingCategories,
    trendingProducts,
    relatedProducts,
    availableProducts,
    sellerSpotlight,
  ] = await Promise.all([
    fetchProductsByTag('todays-deal', 8),
    fetchProductsByTag('best-seller', 8),
    fetchProductsByTag('new-arrival', 4),
    fetchProductsByTag('featured', 4),
    fetchProductsByTag('flash-sale', 4),
    fetchLatestProducts(4),
    fetchTopRatedProducts(4),
    fetchPopularTags(6),
    fetchAllCategories(8),
    fetchTrendingCategories(4),
    fetchTrendingProducts(4),
    fetchRelatedProducts(categories[0]?.name || 'default', 4),
    fetchAvailableProducts(4),
    fetchSellerSpotlight(featuredSellerId, 4),
  ]);

  const carousels = settings.carousels ?? [];

  // Map categories and tags to card items
  const categoryCards = categories.map(mapCategoryToCardItem);
  const allCategoryCards = allCategories;
  const tagCards = popularTags;

  // Define card sections
  const cards: CardSection[] = [
    {
      title: 'Categories to explore',
      link: { text: 'See More', href: '/search' },
      items: categoryCards,
      layout: 'grid',
    },
    {
      title: 'All Categories',
      link: { text: 'Explore All', href: '/search' },
      items: allCategoryCards,
      layout: 'grid',
    },
    {
      title: 'Popular Tags',
      link: { text: 'Explore All', href: '/search' },
      items: tagCards,
      layout: 'grid',
    },
    {
      title: 'Trending Categories',
      link: { text: 'See More', href: '/search' },
      items: trendingCategories,
      layout: 'carousel',
    },
    {
      title: 'Explore New Arrivals',
      items: newArrivals.items,
      link: { text: 'View All', href: '/search?tag=new-arrival' },
      layout: 'carousel',
    },
    {
      title: 'Flash Deals',
      items: flashDeals.items,
      link: { text: 'Shop Now', href: '/search?tag=flash-sale' },
      layout: 'grid',
    },
    {
      title: 'Discover Best Sellers',
      items: bestSellingProducts.items.slice(0, 4),
      link: { text: 'View All', href: '/search?tag=best-seller' },
      layout: 'carousel',
    },
    {
      title: 'Featured Products',
      items: featuredProducts.items,
      link: { text: 'Shop Now', href: '/search?tag=featured' },
      layout: 'grid',
    },
    {
      title: 'Latest Products',
      items: latestProducts.items,
      link: { text: 'View All', href: '/search?sort=latest' },
      layout: 'carousel',
    },
    {
      title: 'Top Rated Products',
      items: topRatedProducts.items,
      link: { text: 'View All', href: '/search?rating=4' },
      layout: 'carousel',
    },
    {
      title: 'Trending Products',
      items: trendingProducts.items,
      link: { text: 'View All', href: '/search?sort=views-desc' },
      layout: 'carousel',
    },
    {
      title: 'Related Products',
      items: relatedProducts.items,
      link: { text: 'View All', href: `/search?category=${encodeURIComponent(categories[0]?.name || 'default')}` },
      layout: 'carousel',
    },
    {
      title: 'Available Now',
      items: availableProducts.items,
      link: { text: 'View All', href: '/search?available=true' },
      layout: 'carousel',
    },
    {
      title: 'Seller Spotlight',
      items: sellerSpotlight.items,
      link: { text: 'View Seller', href: `/seller/${featuredSellerId}` },
      layout: 'carousel',
    },
  ];

  // JSON-LD for WebPage
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: settings.seo?.metaTitle || t('Home'),
    description: settings.seo?.metaDescription || t('MetaDescription'),
    url: `${settings.site?.url || 'https://hager-zon.vercel.app'}/${locale}`,
    publisher: {
      '@type': 'Organization',
      name: settings.site?.name || 'MGZon',
      logo: {
        '@type': 'ImageObject',
        url: settings.site?.logo || `${settings.site?.url || 'https://hager-zon.vercel.app'}/icons/logo.png`,
      },
    },
    mainEntity: {
      '@type': 'CollectionPage',
      name: t('Home'),
      hasPart: cards.map(section => ({
        '@type': 'ItemList',
        name: t(section.title),
        itemListElement: section.items.map(item => ({
          '@type': 'Product',
          name: item.name,
          url: `${settings.site?.url || 'https://hager-zon.vercel.app'}${item.href}`,
          image: item.image,
          offers: item.price ? {
            '@type': 'Offer',
            price: item.price,
            priceCurrency: 'USD',
            availability: 'https://schema.org/InStock',
          } : undefined,
        })),
      })),
    },
  };

  return (
    <main className="min-h-screen" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      {/* JSON-LD Schema */}
      <Script id="json-ld" type="application/ld+json">
        {JSON.stringify(jsonLd)}
      </Script>

      {/* Hero Section */}
      <section className="relative">
        <Suspense fallback={<Skeleton className="h-[400px] w-full" />}>
          <HomeCarousel items={carousels} />
        </Suspense>
      </section>

      {/* Main Content */}
      <div className="md:p-4 md:space-y-4 bg-border">
        {/* Categories, Tags, and Other Sections */}
        <Suspense fallback={<CardSectionSkeleton />}>
          <HomeCard cards={cards} />
        </Suspense>

        {/* Today's Deals */}
        <Suspense fallback={<ProductSliderSkeleton />}>
          {todaysDeals.products.length > 0 ? (
            <Card className="w-full rounded-none">
              <CardContent className="p-4 items-center gap-3">
                <ProductSlider
                  title={t("Today's Deals")}
                  products={todaysDeals.products}
                  hideDetails={false}
                  onItemClick={(product: IProduct) => trackProductView(product._id)}
                />
              </CardContent>
            </Card>
          ) : (
            <ErrorFallback title={t("Today's Deals")} />
          )}
        </Suspense>

        {/* Best Selling Products */}
        <Suspense fallback={<ProductSliderSkeleton />}>
          {bestSellingProducts.products.length > 0 ? (
            <Card className="w-full rounded-none">
              <CardContent className="p-4 items-center gap-3">
                <ProductSlider
                  title={t('Best Selling Products')}
                  products={bestSellingProducts.products}
                  hideDetails={true}
                  onItemClick={(product: IProduct) => trackProductView(product._id)}
                />
              </CardContent>
            </Card>
          ) : (
            <ErrorFallback title={t('Best Selling Products')} />
          )}
        </Suspense>

        {/* Latest Products */}
        <Suspense fallback={<ProductSliderSkeleton />}>
          {latestProducts.products.length > 0 ? (
            <Card className="w-full rounded-none">
              <CardContent className="p-4 items-center gap-3">
                <ProductSlider
                  title={t('Latest Products')}
                  products={latestProducts.products}
                  hideDetails={false}
                  onItemClick={(product: IProduct) => trackProductView(product._id)}
                />
              </CardContent>
            </Card>
          ) : (
            <ErrorFallback title={t('Latest Products')} />
          )}
        </Suspense>

        {/* Top Rated Products */}
        <Suspense fallback={<ProductSliderSkeleton />}>
          {topRatedProducts.products.length > 0 ? (
            <Card className="w-full rounded-none">
              <CardContent className="p-4 items-center gap-3">
                <ProductSlider
                  title={t('Top Rated Products')}
                  products={topRatedProducts.products}
                  hideDetails={false}
                  onItemClick={(product: IProduct) => trackProductView(product._id)}
                />
              </CardContent>
            </Card>
          ) : (
            <ErrorFallback title={t('Top Rated Products')} />
          )}
        </Suspense>

        {/* Trending Products */}
        <Suspense fallback={<ProductSliderSkeleton />}>
          {trendingProducts.products.length > 0 ? (
            <Card className="w-full rounded-none">
              <CardContent className="p-4 items-center gap-3">
                <ProductSlider
                  title={t('Trending Products')}
                  products={trendingProducts.products}
                  hideDetails={false}
                  onItemClick={(product: IProduct) => trackProductView(product._id)}
                />
              </CardContent>
            </Card>
          ) : (
            <ErrorFallback title={t('Trending Products')} />
          )}
        </Suspense>

        {/* Available Now */}
        <Suspense fallback={<ProductSliderSkeleton />}>
          {availableProducts.products.length > 0 ? (
            <Card className="w-full rounded-none">
              <CardContent className="p-4 items-center gap-3">
                <ProductSlider
                  title={t('Available Now')}
                  products={availableProducts.products}
                  hideDetails={false}
                  onItemClick={(product: IProduct) => trackProductView(product._id)}
                />
              </CardContent>
            </Card>
          ) : (
            <ErrorFallback title={t('Available Now')} />
          )}
        </Suspense>

        {/* Seller Spotlight */}
        <Suspense fallback={<ProductSliderSkeleton />}>
          {sellerSpotlight.products.length > 0 ? (
            <Card className="w-full rounded-none">
              <CardContent className="p-4 items-center gap-3">
                <ProductSlider
                  title={t('Seller Spotlight')}
                  products={sellerSpotlight.products}
                  hideDetails={false}
                  onItemClick={(product: IProduct) => trackProductView(product._id)}
                />
              </CardContent>
            </Card>
          ) : (
            <ErrorFallback title={t('Seller Spotlight')} />
          )}
        </Suspense>
      </div>

      {/* Browsing History */}
      <div className="p-4 bg-background">
        <Suspense fallback={<CardSectionSkeleton />}>
          <BrowsingHistoryList />
        </Suspense>
      </div>
    </main>
  );
}

// Cache and revalidation
export const revalidate = 3600; // Revalidate every hour

// Generate static params for localization
export async function generateStaticParams() {
  return [{ locale: 'en' }, { locale: 'ar' }];
}

// Optimize images
export const images = {
  domains: ['res.cloudinary.com', 'hager-zon.vercel.app'],
  deviceSizes: [640, 750, 828, 1080, 1200, 1920],
  imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  formats: ['image/webp'],
};