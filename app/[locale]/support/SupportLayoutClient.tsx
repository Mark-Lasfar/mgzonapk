'use client';

import { usePathname } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Chatbote } from '@/components/shared/Chatbote';

import { FooterDoce } from '@/components/shared/footerDoce';

export default function SupportLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isCreatePage = pathname?.includes('/create') || false;

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950">
      {/* Header */}
      <header className="border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/icons/logo.svg"
              alt="Logo"
              width={48}
              height={48}
              className="animate-slow-spin rounded-full"
            />
            <span className="text-lg font-semibold">MGZON Support</span>
          </Link>

          {/* زر ديناميكي */}
          {isCreatePage ? (
            <Link
              href="/support/tickets"
              className="text-sm font-medium text-primary hover:underline"
            >
              My Tickets
            </Link>
          ) : (
            <Link
              href="/support/tickets/create"
              className="text-sm font-medium text-primary hover:underline"
            >
              Create New Ticket
            </Link>
          )}
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        {children}
      </main>

      <Chatbote />
      <FooterDoce />
    </div>
  );
}
