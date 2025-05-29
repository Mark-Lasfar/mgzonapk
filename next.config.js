const withNextIntl = require('next-intl/plugin')('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Configure fallbacks for client-side Webpack
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        crypto: require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify'),
        buffer: require.resolve('buffer/'),
      };
    }
    return config;
  },
  experimental: {
    // Enable server actions with allowed origins
    serverActions: {
      allowedOrigins: ['localhost:3000', 'hager-zon.vercel.app'],
    },
  },
  images: {
    // Allow remote image sources
    remotePatterns: [
      { protocol: 'https', hostname: 'utfs.io' },
      { protocol: 'https', hostname: 'mg-zon.vercel.app' },
      { protocol: 'https', hostname: 'hager-zon.vercel.app' },
      { protocol: 'http', hostname: 'localhost', port: '3000' },
      { protocol: 'https', hostname: '**' },
    ],
  },
  poweredByHeader: false,
  compress: true,
  eslint: {
    ignoreDuringBuilds: true, // Skip ESLint during builds
  },
  typescript: {
    ignoreBuildErrors: true, // Skip TypeScript errors during builds
  },
  async headers() {
    return [
      {
        // Cache images for one year
        source: '/:all*(svg|jpg|png)',
        locale: false,
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, must-revalidate',
          },
        ],
      },
    ];
  },
};

module.exports = withNextIntl(nextConfig);