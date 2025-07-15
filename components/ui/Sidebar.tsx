'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Home, Package, BarChart, Settings, Bell } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Notification {
  _id: string;
  message: string;
  read: boolean;
  createdAt: string;
}

interface SidebarProps {
  notifications: Notification[];
}

export default function Sidebar({ notifications }: SidebarProps) {
  const t = useTranslations('Sidebar');
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="w-64 bg-gray-800 text-white h-screen p-4">
      <h2 className="text-2xl font-bold mb-6">{t('Dashboard')}</h2>
      <nav className="space-y-2">
        <Link href="/seller/dashboard">
          <Button variant="ghost" className="w-full justify-start text-white hover:bg-gray-700">
            <Home className="mr-2 h-4 w-4" /> {t('Home')}
          </Button>
        </Link>
        <Link href="/seller/dashboard/ads">
          <Button variant="ghost" className="w-full justify-start text-white hover:bg-gray-700">
            <Package className="mr-2 h-4 w-4" /> {t('Ads')}
          </Button>
        </Link>
        <Link href="/seller/dashboard/integrations">
          <Button variant="ghost" className="w-full justify-start text-white hover:bg-gray-700">
            <Settings className="mr-2 h-4 w-4" /> {t('Integrations')}
          </Button>
        </Link>
        <Link href="/seller/dashboard/analytics">
          <Button variant="ghost" className="w-full justify-start text-white hover:bg-gray-700">
            <BarChart className="mr-2 h-4 w-4" /> {t('Analytics')}
          </Button>
        </Link>
        <Link href="/seller/dashboard/notifications">
          <Button variant="ghost" className="w-full justify-start text-white hover:bg-gray-700">
            <Bell className="mr-2 h-4 w-4" /> {t('Notifications')}
            {unreadCount > 0 && <Badge variant="destructive" className="ml-2">{unreadCount}</Badge>}
          </Button>
        </Link>
      </nav>
    </div>
  );
}