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
import { LogOut, User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

function UnauthorizedSection() {
  return (
    <div className="flex min-h-screen flex-col">
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
          <div className="flex flex-col items-center space-y-6 text-center">
            <h1 className="text-3xl font-bold tracking-tighter">
              Seller Account Required
            </h1>
            <p className="text-muted-foreground max-w-[600px]">
              You need to register as a seller to access the dashboard. Please complete your seller registration to continue.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button asChild variant="default" className="min-w-[200px]">
                <Link href="/seller/registration">Register as Seller</Link>
              </Button>
              <Button asChild variant="outline" className="min-w-[200px]">
                <Link href="/">Return to Home</Link>
              </Button>
            </div>
          </div>
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
  try {
    const session = await auth();
    if (!session) {
      redirect('/sign-in');
    }

    const sellerResponse = await getSellerByUserId(session.user.id!);
    if (!sellerResponse.success || !sellerResponse.data) {
      return <UnauthorizedSection />;
    }

    const { site } = await getSetting();
    const seller = sellerResponse.data;

    return (
      <div className="flex flex-col min-h-screen">
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-16 items-center justify-between">
            <div className="flex items-center gap-8">
              <Link href="/" className="flex items-center space-x-2">
                <Image
                  src={seller.logo || '/icons/logo.svg'} // Use seller's logo if available
                  width={40}
                  height={40}
                  alt={`${seller.businessName} logo`}
                  className="dark:invert"
                  priority
                />
                <span className="font-bold hidden md:inline-block">
                  {seller.businessName} Seller
                </span>
              </Link>
              <SellerNav className="hidden md:flex" />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-8 w-8 rounded-full"
                  aria-label="User menu"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage
                      src={session.user.image || '/images/default-avatar.png'}
                      alt={session.user.name || 'User Avatar'}
                    />
                    <AvatarFallback>
                      {session.user.name?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {session.user.name}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {session.user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link
                    href="/seller/dashboard/profile"
                    className="flex items-center"
                  >
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    href="/api/auth/signout"
                    className="flex items-center text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="md:hidden border-t">
            <SellerNav className="flex overflow-x-auto px-4 py-2" />
          </div>
        </header>

        <main className="flex-1">
          <div className="container py-6">{children}</div>
        </main>
      </div>
    );
  } catch (error) {
    console.error('Error in SellerDashboardLayout:', error);
    if (
      error instanceof Error &&
      (error.message.includes('unauthorized') ||
        error.message.includes('seller') ||
        error.message.includes('permission'))
    ) {
      return <UnauthorizedSection />;
    }
    redirect('/error');
  }
}