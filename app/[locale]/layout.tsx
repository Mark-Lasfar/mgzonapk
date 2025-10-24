import { Geist, Geist_Mono } from 'next/font/google'
import '../globals.css'
import ClientProviders from '@/components/shared/client-providers'
import { getDirection } from '@/i18n-config'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import { notFound } from 'next/navigation'
import { getSetting } from '@/lib/actions/setting.actions'
import { cookies } from 'next/headers'
import { Metadata } from 'next'
import JsonLd from '@/components/json-ld'
import PerformanceMetrics from '@/components/performance-metrics'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

interface Locale {
  locale: string
}

function validateLocale(locale?: string): string {
  if (!locale || !routing.locales.includes(locale)) {
    console.warn('⚠️ Locale is invalid or missing:', locale);
    return routing.defaultLocale || 'en'; // أو استبدل 'en' بالافتراضي عندك
  }
  return locale;
}


export async function generateMetadata({
  params,
}: {
  params: { locale: string }
}): Promise<Metadata> {
  try {
    const { locale } =  params;
    const validLocale = validateLocale(locale);
    const {
      site: { slogan, name, description, url },
      seo,
    } = await getSetting();
    const baseUrl = url || process.env.NEXT_PUBLIC_BASE_URL || 'https://hager-zon.vercel.app';

    const keywords = [
      // Primary Keywords
      'mgzon',
      'ecommerce',
      'online shopping',
      'marketplace',
      'best deals',
      'secure shopping',
      'fast delivery',
      // Shopping Categories
      'electronics',
      'clothing',
      'home appliances',
      'sports equipment',
      'beauty products',
      'books',
      'accessories',
      // Business and Commerce
      'sell online',
      'buy online',
      'wholesale',
      'best products',
      // Shopping Experience
      'customer reviews',
      'product ratings',
      'easy returns',
      'secure payments',
      // Location and Language
      'global marketplace',
      'international shipping',
      'multi-language support',
      // Mobile and Tech
      'mobile shopping',
      'shopping app',
      ...(seo?.keywords?.split(', ') || []), // إضافة كلمات مفتاحية من settings.seo
    ];

    const metadataDescription = `${description} | Shop online for electronics, clothing, home appliances, and more at MGZon. Best prices, secure shopping, worldwide delivery.`;

    const metadata: Metadata = {
      title: {
        template: `%s | ${name}`,
        default: `${name} - ${slogan}`,
      },
      description: metadataDescription,
      metadataBase: new URL(baseUrl),
      alternates: {
        canonical: baseUrl,
        languages: Object.fromEntries(
          routing.locales.map((locale) => [locale, `/${locale}`])
        ),
      },
      verification: {
        google: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION || 'PQo-i3w5jhSFT2MCdZxg0HnFOHDQ-iYMLNg8rYeFtXM',
        yandex: process.env.NEXT_PUBLIC_YANDEX_VERIFICATION || 'G-38F9VZMY43',
        other: {
          'msvalidate.01': process.env.NEXT_PUBLIC_BING_VERIFICATION || 'B43661E5D49F850A9492D8B9EF683229',
          'baidu-site-verification': 'baidu-verification-code',
        },
      },
      robots: {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          'max-video-preview': -1,
          'max-image-preview': 'large',
          'max-snippet': -1,
        },
        nocache: true,
      },
      openGraph: {
        type: 'website',
        locale: validLocale,
        url: baseUrl,
        title: name,
        description: metadataDescription,
        siteName: name,
        images: [
          {
            url: `${baseUrl}/icons/icon-512x512.png`,
            width: 512,
            height: 512,
            alt: name,
          },
          {
            url: `${baseUrl}/icons/icon-192x192.png`,
            width: 192,
            height: 192,
            alt: name,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: name,
        description: metadataDescription,
        images: [`${baseUrl}/icons/icon-512x512.png`],
        creator: '@mgzon_official',
        site: '@mgzon_official',
      },
      icons: {
        icon: '/icons/icon-192x192.png',
        shortcut: '/icons/icon-192x192.png',
        apple: '/icons/icon-192x192.png',
        other: {
          rel: 'apple-touch-icon-precomposed',
          url: '/icons/icon-192x192.png',
        },
      },
      manifest: '/manifest.json',
      authors: [
        { name: 'MGZon Team', url: 'https://hager-zon.vercel.app' },
      ],
      generator: 'Next.js',
      keywords: keywords.join(', '),
      creator: 'MGZon Team',
      publisher: 'MGZon',
      category: 'ecommerce',
      applicationName: 'MGZon',
      referrer: 'origin-when-cross-origin',
      formatDetection: {
        email: false,
        address: false,
        telephone: false,
      },
    };

    return metadata;
  } catch (error) {
    console.error('Metadata generation error:', error);
    return {
      title: 'MGZon E-commerce',
      description: 'Your ultimate shopping destination',
      verification: {
        google: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION || 'PQo-i3w5jhSFT2MCdZxg0HnFOHDQ-iYMLNg8rYeFtXM',
        other: {
          'msvalidate.01': process.env.NEXT_PUBLIC_BING_VERIFICATION || 'B43661E5D49F850A9492D8B9EF683229',
        },
      },
    };
  }
}


// Exports for viewport and themeColor are required by Next.js 15+
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export const themeColor = [
  { media: '(prefers-color-scheme: light)', color: 'white' },
  { media: '(prefers-color-scheme: dark)', color: 'black' },
]

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { locale: string }

}) {

  try {
    const { locale } =  params;
    const validLocale = validateLocale(locale)

    const [setting, cookieStore, messages] = await Promise.all([
      getSetting(),
      cookies(),
      getMessages(),
    ])

    const currencyCookie = cookieStore.get('currency')
    const currency = currencyCookie?.value || 'USD'

    const baseUrl = setting.site.url || process.env.NEXT_PUBLIC_BASE_URL || 'https://hager-zon.vercel.app'

    return (
      <html
        lang={validLocale}
        dir={getDirection(validLocale) === 'rtl' ? 'rtl' : 'ltr'}
        suppressHydrationWarning
      >
        <head>
          <meta charSet="utf-8" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1, maximum-scale=5"
          />
          <meta name="format-detection" content="telephone=no" />
          <meta name="mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="black" />
          <meta name="apple-mobile-web-app-title" content="MGZon" />
          <meta name="application-name" content="MGZon" />
          <meta name="msapplication-TileColor" content="#000000" />
          {/* Do not include theme-color meta here, it's handled by the export */}
          <link rel="manifest" href="/manifest.json" />
          <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
          <link
            rel="icon"
            type="image/png"
            sizes="192x192"
            href="/icons/icon-192x192.png"
          />
          <link
            rel="icon"
            type="image/png"
            sizes="512x512"
            href="/icons/icon-512x512.png"
          />
          <link rel="alternate" hrefLang="x-default" href={baseUrl} />
          {routing.locales.map((loc) => (
            <link
              key={loc}
              rel="alternate"
              hrefLang={loc}
              href={`${baseUrl}/${loc}`}
            />
          ))}
          {/* Google Analytics (GTM/GA4) */}
          <script async src={`https://www.googletagmanager.com/gtag/js?id=${process.env.GTM_ID}`}></script>
          <script
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${process.env.GTM_ID}');
              `,
            }}
          />
        </head>
        <body
          className={`min-h-screen ${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          <JsonLd
            data={{
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: setting.site.name,
              description: setting.site.description,
              url: baseUrl,
              potentialAction: {
                '@type': 'SearchAction',
                target: {
                  '@type': 'EntryPoint',
                  urlTemplate: `${baseUrl}/search?q={search_term_string}`,
                },
                'query-input': 'required name=search_term_string',
              },
              sameAs: [
                'https://twitter.com/mgz0m',
                'https://www.facebook.com/profile.php?id=61581526301289',
                //  https://www.facebook.com/profile.php?id=61581526301289
                'https://instagram.com/mgzon',
                'https://linkedin.com/company/mgzon',
              ],
            }}
          />
          <PerformanceMetrics />
          <NextIntlClientProvider locale={validLocale} messages={messages}>
            <ClientProviders setting={{ ...setting, currency }}>
              {children}
            </ClientProviders>
          </NextIntlClientProvider>
        </body>
      </html>
    )
  } catch (error) {
    console.error('Layout error:', error)
    notFound()
  }
}