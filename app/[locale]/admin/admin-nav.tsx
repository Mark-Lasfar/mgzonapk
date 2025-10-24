'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils.client';
import { useTranslations } from 'next-intl';

const links = [
  { title: 'Portfolio', href: '/admin/portfolio' },
  { title: 'Overview', href: '/admin-overview' },
  { title: 'Products', href: '/admin/products' },
  { title: 'Orders', href: '/admin/orders' },
  { title: 'Users', href: '/admin/users' },
  { title: 'Sellers', href: '/admin/sellers' },
  { title: 'News', href: '/admin/news' }, // Added News
  { title: 'Review Apps', href: '/admin/clients/review' }, 
  { title: 'Authors', href: '/admin/authors' }, // Added Authors
  { title: 'Add Integrations', href: '/admin/integrations/add' },
  { title: 'Subscriptions', href: '/admin/subscriptions' },
  { title: 'Integrations Dashboard', href: '/admin/integrations-dashboard' },
  { title: 'Pages', href: '/admin/web-pages' },
  { title: 'API Keys', href: '/admin/api-keys' },
  { title: 'Platform Reports', href: '/admin/reports' },
  { title: 'Withdrawals', href: '/admin/withdrawals' },
  { title: 'Earnings and Commissions Report', href: '/admin/reports/earnings' },
  { title: 'Tickets', href: '/admin/tickets' },
  { title: 'Settings', href: '/admin/settings' },
  { title: 'Notifications', href: '/admin/notifications' },
  { title: 'Logs', href: '/admin/logs' },
  { title: 'Support', href: '/admin/support' },
  { title: 'Support Tickets', href: '/admin/support/tickets' },
];

export function AdminNav({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  const pathname = usePathname();
  const t = useTranslations('Admin');

  return (
    <nav className={cn('flex items-center flex-wrap overflow-hidden gap-2 md:gap-4', className)} {...props}>
      {links.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn('', pathname.includes(item.href) ? 'text-foreground' : 'text-muted-foreground')}
        >
          {t(item.title)}
        </Link>
      ))}
    </nav>
  );
}