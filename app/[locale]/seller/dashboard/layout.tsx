// app/[locale]/(root)/seller/dashboard/layout.tsx
import Image from 'next/image';
import Link from 'next/link';
import React from 'react';
import { SellerNav } from './seller-nav';
import { getSetting } from '@/lib/actions/setting.actions';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getSellerByUserId } from '@/lib/actions/seller.actions';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { LogOut, User, Menu } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { connectToDatabase } from '@/lib/db';
import Seller from '@/lib/db/models/seller.model';
import { getTranslations } from 'next-intl/server';
import { isAfter } from 'date-fns';
import { Toaster } from '@/components/ui/toast';
import { motion } from 'framer-motion';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

async function UnauthorizedSection({ t }: { t: (key: string) => string }) {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center">
          <Link href="/" className="flex items-center space-x-2">
            <Image
              src="/icons/logo.svg"
              width={40}
              height={40}
              alt="Site Logo"
              className="dark:invert"
              priority
            />
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <div className="container flex flex-col items-center justify-center min-h-[80vh] py-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center space-y-6 text-center"
          >
            <h1 className="text-3xl font-bold tracking-tighter">{t('unauthorized.title')}</h1>
            <p className="text-muted-foreground max-w-[600px]">{t('unauthorized.description')}</p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button asChild variant="default" className="min-w-[200px]">
                <Link href="/seller/registration">{t('unauthorized.registerButton')}</Link>
              </Button>
              <Button asChild variant="outline" className="min-w-[200px]">
                <Link href="/">{t('unauthorized.homeButton')}</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}

async function SubscriptionExpiredSection({ t }: { t: (key: string) => string }) {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center">
          <Link href="/" className="flex items-center space-x-2">
            <Image
              src="/icons/logo.svg"
              width={40}
              height={40}
              alt="Site Logo"
              className="dark:invert"
              priority
            />
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <div className="container flex flex-col items-center justify-center min-h-[80vh] py-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center space-y-6 text-center"
          >
            <h1 className="text-3xl font-bold tracking-tighter">{t('expired.title')}</h1>
            <p className="text-muted-foreground max-w-[600px]">{t('expired.description')}</p>
            <Button asChild variant="default" className="min-w-[200px]">
              <Link href="/account/subscriptions">{t('expired.renewButton')}</Link>
            </Button>
          </motion.div>
        </div>
      </main>
    </div>
  );
}

export default async function SellerDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations('Seller Dashboard');

  try {
    const session = await auth();
    if (!session) redirect('/sign-in');

    await connectToDatabase();

    const isAdmin = session.user.role === 'Admin';
    let seller = null;

    if (!isAdmin) {
      const sellerResponse = await getSellerByUserId(session.user.id!);
      if (!sellerResponse.success || !sellerResponse.data) {
        return <UnauthorizedSection t={t} />;
      }

      seller = sellerResponse.data;

      const currentDate = new Date();
      if (
        seller.subscription.status !== 'active' ||
        (seller.subscription.endDate && isAfter(currentDate, new Date(seller.subscription.endDate)))
      ) {
        await Seller.findByIdAndUpdate(seller._id, {
          'subscription.status': 'expired',
          isActive: false,
        });
        return <SubscriptionExpiredSection t={t} />;
      }
    }

    const { site } = await getSetting();

    return (
      <div className="flex min-h-screen bg-background">
        {/* Mobile Sidebar (Sheet) */}
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="fixed top-4 left-4 z-50 md:hidden"
              aria-label={t('header.menu')}
            >
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0 bg-card">
            {/* Sticky Header in Mobile */}
            <div className="sticky top-0 z-10 border-b bg-card p-4">
              <Link href="/seller/dashboard" className="flex items-center gap-2 font-semibold">
                <Image
                  src={(seller?.logo as string) || '/icons/logo.svg'}
                  width={40}
                  height={40}
                  alt={t('header.logoAlt', { businessName: seller?.businessName || site.name })}
                  className="dark:invert"
                />
                <span className="truncate">{seller?.businessName || site.name}</span>
              </Link>
            </div>
            {/* Scrollable Nav */}
            <div className="h-[calc(100vh-4rem)] overflow-y-auto p-4">
              <SellerNav />
            </div>
          </SheetContent>
        </Sheet>

        {/* Desktop Sidebar */}
        <aside className="hidden md:flex w-64 flex-col border-r bg-card">
          {/* Sticky Header */}
          <div className="sticky top-0 z-10 border-b bg-card p-4">
            <Link href="/seller/dashboard" className="flex items-center gap-2 font-semibold">
              <Image
                src={(seller?.logo as string) || '/icons/logo.svg'}
                width={40}
                height={40}
                alt={t('header.logoAlt', { businessName: seller?.businessName || site.name })}
                className="dark:invert"
              />
              <span className="truncate">{seller?.businessName || site.name}</span>
            </Link>
          </div>
          {/* Scrollable Nav */}
          <div className="flex-1 overflow-y-auto p-4">
            <SellerNav />
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
            <div className="container flex h-16 items-center justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="relative h-8 w-8 rounded-full"
                    aria-label={t('header.userMenu')}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage
                        src={session.user.image || '/images/default-avatar.png'}
                        alt={t('header.avatarAlt', { userName: session.user.name || 'user' })}
                      />
                      <AvatarFallback>{session.user.name?.charAt(0) || 'U'}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{session.user.name}</p>
                      <p className="text-xs leading-none text-muted-foreground">{session.user.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/seller/dashboard/profile" className="flex items-center">
                      <User className="mr-2 h-4 w-4" />
                      {t('header.profile')}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/api/auth/signout" className="flex items-center text-destructive">
                      <LogOut className="mr-2 h-4 w-4" />
                      {t('header.logout')}
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <main className="flex-1">
            <div className="container py-6">{children}</div>
            <Toaster />
          </main>
        </div>
      </div>
    );
  } catch (error) {
    console.error('Error in SellerDashboardLayout:', error);
    return <UnauthorizedSection t={t} />;
  }
}