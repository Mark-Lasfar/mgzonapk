'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React from 'react'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'

const links = [
  {
    title: 'Overview',
    href: '/seller/dashboard',
  },
  {
    title: 'Products',
    href: '/seller/dashboard/products',
  },
  {
    title: 'Orders',
    href: '/seller/dashboard/orders',
  },
  {
    title: 'Analytics',
    href: '/seller/dashboard/analytics',
  },
  {
    title: 'Settings',
    href: '/seller/dashboard/settings',
  },
]

export function SellerNav({
  className,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  const pathname = usePathname()
  const t = useTranslations('Seller')
  
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
            '',
            pathname === item.href ? '' : 'text-muted-foreground'
          )}
        >
          {t(item.title)}
        </Link>
      ))}
    </nav>
  )
}