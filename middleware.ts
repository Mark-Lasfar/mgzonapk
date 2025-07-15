import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import NextAuth from 'next-auth';
import authConfig from './auth.config';

const publicPages = [
  '/',
  '/search',
  '/sign-in',
  '/sign-up',
  '/reset-password',
  '/verify-code',
  '/auth/error',
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
  const { pathname } = req.nextUrl;

  // تخطي الـ API routes والملفات الثابتة
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.match(/\.(png|jpg|jpeg|svg|ico|css|js)$/)
  ) {
    return intlMiddleware(req);
  }

  const publicPathnameRegex = RegExp(
    `^(/(${routing.locales.join('|')}))?(${publicPages
      .flatMap((p) => (p === '/' ? ['', '/'] : p))
      .join('|')})/?$`,
    'i'
  );
  const isPublicPage = publicPathnameRegex.test(pathname);

  // إعادة توجيه المستخدمين المسجلين من صفحات معينة
  if (
    req.auth &&
    ['/reset-password', '/verify-code'].some(
      (path) => pathname.startsWith(`/${routing.locales.join('|')}${path}`) || pathname === path
    )
  ) {
    console.log(`[Middleware] Authenticated user accessing ${pathname}, redirecting to /account`);
    return Response.redirect(new URL(`/${req.nextUrl.locale}/account`, req.nextUrl.origin));
  }

  // السماح بالصفحات العامة
  if (isPublicPage) {
    return intlMiddleware(req);
  }

  // إعادة توجيه لو المستخدم مش مسجل
  if (!req.auth) {
    console.log(`[Middleware] Unauthenticated access to ${pathname}, redirecting to sign-in`);
    const newUrl = new URL(
      `/${req.nextUrl.locale}/sign-in?callbackUrl=${encodeURIComponent(pathname)}`,
      req.nextUrl.origin
    );
    return Response.redirect(newUrl);
  }

  return intlMiddleware(req);
});

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};