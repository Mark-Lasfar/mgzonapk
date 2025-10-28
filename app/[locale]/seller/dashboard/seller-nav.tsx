'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils.client';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import {
  Home,
  Package,
  ShoppingCart,
  BarChart3,
  DollarSign,
  Palette,
  Tag,
  Settings,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Bell,
  Shield,
  Globe,
  FileText,
  MessageSquare,
  Layout,
  Layers,
  Package2,
  Truck,
  Percent,
  CheckSquare,
  Link2,
  FileCheck,
  Wallet,
  Store,
  User,
  ArrowLeftRight,   // للـ Transfer
  FileSearch,       // للـ Audit Logs
  PlusCircle,       // للـ Create Product
} from 'lucide-react';
import { useState } from 'react';

type NavItem = {
  title: string;
  href?: string;
  icon?: React.ReactNode;
  children?: NavItem[];
};

const navGroups: NavItem[] = [
  {
    title: 'Overview',
    href: '/seller/dashboard',
    icon: <Home className="h-4 w-4" />,
  },
  {
    title: 'Products',
    icon: <Package className="h-4 w-4" />,
    children: [
      {
        title: 'All Products',
        href: '/seller/dashboard/products',
        icon: <Package2 className="h-4 w-4" />,
      },
      {
        title: 'Create Product',
        href: '/seller/dashboard/products/create',
        icon: <PlusCircle className="h-4 w-4" />,
      },
      {
        title: 'Transfer Products',
        href: '/seller/dashboard/products/transfer',
        icon: <ArrowLeftRight className="h-4 w-4" />,
      },
      {
        title: 'Audit Logs',
        href: '/seller/dashboard/products/audit',
        icon: <FileSearch className="h-4 w-4" />,
      },
    ],
  },
  {
    title: 'Ads',
    icon: <BarChart3 className="h-4 w-4" />,
    children: [
      {
        title: 'Campaigns',
        href: '/seller/dashboard/ads',
        icon: <BarChart3 className="h-4 w-4" />,
      },
      {
        title: 'Create Ad',
        href: '/seller/dashboard/ads/create',
        icon: <BarChart3 className="h-4 w-4" />,
      },
    ],
  },
  {
    title: 'Orders',
    icon: <ShoppingCart className="h-4 w-4" />,
    children: [
      {
        title: 'All Orders',
        href: '/seller/dashboard/orders',
        icon: <ShoppingCart className="h-4 w-4" />,
      },
      {
        title: 'Pending',
        href: '/seller/dashboard/orders?status=pending',
        icon: <ShoppingCart className="h-4 w-4" />,
      },
      {
        title: 'Shipped',
        href: '/seller/dashboard/orders?status=shipped',
        icon: <Truck className="h-4 w-4" />,
      },
    ],
  },
  {
    title: 'Analytics',
    href: '/seller/dashboard/analytics',
    icon: <BarChart3 className="h-4 w-4" />,
  },
  {
    title: 'Withdrawals',
    href: '/seller/dashboard/withdrawals',
    icon: <DollarSign className="h-4 w-4" />,
  },
  {
    title: 'Designs',
    href: '/seller/dashboard/pod/designs',
    icon: <Palette className="h-4 w-4" />,
  },
  {
    title: 'Points',
    href: '/seller/dashboard/points',
    icon: <Tag className="h-4 w-4" />,
  },
  {
    title: 'Settings',
    icon: <Settings className="h-4 w-4" />,
    children: [
      { title: 'Business Info', href: '/seller/dashboard/settings#businessInfo', icon: <Store className="h-4 w-4" /> },
      { title: 'Address', href: '/seller/dashboard/settings#address', icon: <Globe className="h-4 w-4" /> },
      { title: 'Bank Info', href: '/seller/dashboard/settings#bankInfo', icon: <Wallet className="h-4 w-4" /> },
      { title: 'Account', href: '/seller/dashboard/settings#account', icon: <User className="h-4 w-4" /> },
      { title: 'Subscription', href: '/seller/dashboard/settings#subscription', icon: <CreditCard className="h-4 w-4" /> },
      { title: 'Discounts', href: '/seller/dashboard/settings#discounts', icon: <Percent className="h-4 w-4" /> },
      { title: 'Notifications', href: '/seller/dashboard/settings#notifications', icon: <Bell className="h-4 w-4" /> },
      { title: 'Display', href: '/seller/dashboard/settings#display', icon: <Layout className="h-4 w-4" /> },
      { title: 'Security', href: '/seller/dashboard/settings#security', icon: <Shield className="h-4 w-4" /> },
      { title: 'Custom Site', href: '/seller/dashboard/settings#customSite', icon: <Layers className="h-4 w-4" /> },
      { title: 'Taxes', href: '/seller/dashboard/settings#taxes', icon: <FileText className="h-4 w-4" /> },
      { title: 'Domains', href: '/seller/dashboard/settings#domains', icon: <Link2 className="h-4 w-4" /> },
      { title: 'Domains', href: '/seller/dashboard/settings#domainstb', icon: <Link2 className="h-4 w-4" /> },
      { title: 'Verification', href: '/seller/dashboard/settings#verification', icon: <FileCheck className="h-4 w-4" /> },
      { title: 'Integrations', href: '/seller/dashboard/settings#integrations', icon: <Link2 className="h-4 w-4" /> },
      { title: 'Payment Methods', href: '/seller/dashboard/settings#paymentMethods', icon: <CreditCard className="h-4 w-4" /> },
      { title: 'Delivery Dates', href: '/seller/dashboard/settings#deliveryDates', icon: <Truck className="h-4 w-4" /> },
      { title: 'Template', href: '/seller/dashboard/settings#template', icon: <Layout className="h-4 w-4" /> },
      { title: 'Template Editor', href: '/seller/dashboard/settings#templateeditor', icon: <Palette className="h-4 w-4" /> },
      { title: 'Manage Pages', href: '/seller/dashboard/settings#managePages', icon: <FileText className="h-4 w-4" /> },
      { title: 'Messages', href: '/seller/dashboard/settings#messages', icon: <MessageSquare className="h-4 w-4" /> },
    ],
  },
  {
    title: 'Integrations',
    href: '/seller/dashboard/integrations',
    icon: <Settings className="h-4 w-4" />,
  },
];

export function SellerNav({ className }: React.HTMLAttributes<HTMLElement>) {
  const pathname = usePathname();
  const t = useTranslations('Seller');
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(['Products', 'Settings'])); // افتح Products و Settings افتراضيًا

  const toggleGroup = (title: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  // تحديد الحالة النشطة (يدعم الـ hash والـ query params)
  const isActive = (href?: string) => {
    if (!href) return false;

    // دعم الـ hash (مثل #businessInfo)
    if (href.includes('#')) {
      const [path, hash] = href.split('#');
      const currentHash = window.location.hash.slice(1);
      return pathname === path && currentHash === hash;
    }

    // دعم الـ query params (مثل ?status=pending)
    if (href.includes('?')) {
      const [basePath, query] = href.split('?');
      if (pathname !== basePath) return false;
      const urlParams = new URLSearchParams(query);
      const currentParams = new URLSearchParams(window.location.search);
      let match = true;
      urlParams.forEach((value, key) => {
        if (currentParams.get(key) !== value) match = false;
      });
      return match;
    }

    // مسار عادي
    return pathname.startsWith(href) && href !== '/seller/dashboard';
  };

  const renderItem = (item: NavItem, depth = 0) => {
    const hasChildren = !!item.children?.length;
    const key = item.title;

    if (hasChildren) {
      const isOpen = openGroups.has(key);

      return (
        <Collapsible key={key} open={isOpen} onOpenChange={() => toggleGroup(key)}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                'w-full justify-between text-left font-medium',
                isActive(item.href) && 'bg-accent text-accent-foreground'
              )}
            >
              <div className="flex items-center gap-2">
                {item.icon}
                <span>{t(item.title)}</span>
              </div>
              {isOpen ? (
                <ChevronDown className="h-4 w-4 transition-transform" />
              ) : (
                <ChevronRight className="h-4 w-4 transition-transform" />
              )}
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent className="pl-6 space-y-1">
            {item.children!.map((sub) => renderItem(sub, depth + 1))}
          </CollapsibleContent>
        </Collapsible>
      );
    }

    return (
      <Link
        key={item.href}
        href={item.href!}
        className={cn(
          'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          isActive(item.href)
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        )}
        onClick={(e) => {
          if (item.href?.includes('#')) {
            e.preventDefault();
            const [path, hash] = item.href!.split('#');
            window.history.pushState(null, '', `${path}#${hash}`);
            document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' });
          }
        }}
      >
        {depth > 0 && <span className="w-4" />}
        {item.icon}
        <span>{t(item.title)}</span>
      </Link>
    );
  };

  return (
    <nav className={cn('flex flex-col gap-1 p-2', className)}>
      {navGroups.map((group) => renderItem(group))}
    </nav>
  );
}