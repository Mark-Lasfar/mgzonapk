'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

const links = [
  { title: 'Overview', href: '/seller/dashboard' },
  { title: 'Products', href: '/seller/dashboard/products' },
  { title: 'ads', href: '/seller/dashboard/ads' },
  { title: 'Orders', href: '/seller/dashboard/orders' },
  { title: 'Analytics', href: '/seller/dashboard/analytics' },
  { title: 'Withdrawals', href: '/seller/dashboard/withdrawals' },
  { title: 'Designs', href: '/pod/designs' },
  { title: 'Points', href: '/seller/dashboard/points' },
  { title: '',  href: '/seller/dashboard/integrations', label: ('Integrations') },
  { title: 'Settings', href: '/seller/dashboard/settings' },

];



export function SellerNav({
  className,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  const pathname = usePathname();
  const t = useTranslations('Seller');

  return (
    <nav
      className={cn(
        'flex items-center flex-wrap overflow-hidden gap-2 md:gap-4',
        className
      )}
      {...props}
    >
      {links.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            'px-3 py-2 rounded-md text-sm font-medium',
            pathname === item.href
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          )}
        >
          {t(item.title)}
        </Link>
      ))}
    </nav>
  );
}