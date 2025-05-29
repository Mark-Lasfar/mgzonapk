import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import NextAuth from 'next-auth';
import authConfig from './auth.config';

const publicPages = [
  '/',
  '/search',
  '/sign-in',
  '/sign-up',
  '/reset-password', // Added for unauthenticated access
  '/verify-code', // Added for unauthenticated access
  '/auth/error', // Added for authentication error page
  '/cart',
  '/cart/(.*)',
  '/product/(.*)',
  '/page/(.*)',
  '/sitemap.xml',
  '/sitemap-index.xml',
  '/sitemap-products.xml',
  '/sitemap-blog.xml',
  '/sitemap-images.xml',
  '/robots.txt',
  '/.well-known/security.txt',
  '/manifest.json',
];

const intlMiddleware = createMiddleware(routing);
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const publicPathnameRegex = RegExp(
    `^(/(${routing.locales.join('|')}))?(${publicPages
      .flatMap((p) => (p === '/' ? ['', '/'] : p))
      .join('|')})/?$`,
    'i'
  );
  const isPublicPage = publicPathnameRegex.test(req.nextUrl.pathname);

  // Redirect authenticated users from /reset-password and /verify-code
  if (req.auth && ['/reset-password', '/verify-code'].some((path) => req.nextUrl.pathname.startsWith(`/${routing.locales.join('|')}${path}`) || req.nextUrl.pathname === path)) {
    console.log(`[Middleware] Authenticated user accessing ${req.nextUrl.pathname}, redirecting to /account`);
    return Response.redirect(new URL(`/${req.nextUrl.locale}/account`, req.nextUrl.origin));
  }

  if (isPublicPage) {
    return intlMiddleware(req);
  }

  if (!req.auth) {
    console.log(`[Middleware] Unauthenticated access to ${req.nextUrl.pathname}, redirecting to sign-in`);
    const newUrl = new URL(
      `/${req.nextUrl.locale}/sign-in?callbackUrl=${encodeURIComponent(req.nextUrl.pathname)}`,
      req.nextUrl.origin
    );
    return Response.redirect(newUrl);
  }

  return intlMiddleware(req);
});

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};