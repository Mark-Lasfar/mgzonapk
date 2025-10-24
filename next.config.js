   const withNextIntl = require('next-intl/plugin')('./i18n/request.ts');

   /** @type {import('next').NextConfig} */
   const nextConfig = {
     webpack: (config, { isServer }) => {
       if (!isServer) {
         config.resolve.fallback = {
           ...config.resolve.fallback,
           child_process: false,
           dns: false,
           fs: false,
           net: false,
           tls: false,
           events: require.resolve('events/'),
           process: require.resolve('process/browser'),
           util: require.resolve('util/'),
           crypto: require.resolve('crypto-browserify'),
           stream: require.resolve('stream-browserify'),
           buffer: require.resolve('buffer/'),
           path: false,
           zlib: false,
           'timers/promises': false,
         };
       }
       return config;
     },
     experimental: {
       serverActions: {
         allowedOrigins: ['localhost:3000', 'hager-zon.vercel.app'],
       },
     },
     images: {
       remotePatterns: [
         { protocol: 'https', hostname: 'utfs.io' },
         { protocol: 'https', hostname: 'res.cloudinary.com' },
         { protocol: 'https', hostname: 'mg-zon.vercel.app' },
         { protocol: 'https', hostname: 'hager-zon.vercel.app' },
         { protocol: 'http', hostname: 'localhost', port: '3000' },
         { protocol: 'https', hostname: '**' },
       ],
     },
     poweredByHeader: false,
     compress: true,
     eslint: {
       ignoreDuringBuilds: true,
     },
     typescript: {
       ignoreBuildErrors: true,
     },
     async headers() {
       return [
         {
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