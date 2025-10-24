'use client'
import { Button } from '@/components/ui/button'
import {
  CreditCard,
  Currency,
  ImageIcon,
  Info,
  Languages,
  Package,
  PointerIcon,
  SettingsIcon,
  Star, // أيقونة جديدة للاشتراكات
  Bot,
} from 'lucide-react'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const SettingNav = () => {
  const [active, setActive] = useState('')

  useEffect(() => {
    const sections = document.querySelectorAll('div[id^="setting-"]')

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActive(entry.target.id)
          }
        })
      },
      { threshold: 0.6, rootMargin: '0px 0px -40% 0px' }
    )
    sections.forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [])

  const handleScroll = (id: string) => {
    const section = document.getElementById(id)
    if (section) {
      const top = section.offsetTop - 16 // 20px above the section
      window.scrollTo({ top, behavior: 'smooth' })
    }
  }

  const handleExternalLink = (href: string) => {
    window.location.href = href // للروابط الخارجية زي /admin/subscriptions
  }

  return (
    <div>
      <h1 className="h1-bold">Setting</h1>
      <nav className="flex md:flex-col gap-2 md:fixed mt-4 flex-wrap">
        {[
          { name: 'Site Info', hash: 'setting-site-info', icon: <Info /> },
          {
            name: 'Common Settings',
            hash: 'setting-common',
            icon: <SettingsIcon />,
          },
          {
            name: 'Carousels',
            hash: 'setting-carousels',
            icon: <ImageIcon />,
          },
          { name: 'Languages', hash: 'setting-languages', icon: <Languages /> },
          {
            name: 'Currencies',
            hash: 'setting-currencies',
            icon: <Currency />,
          },
          {
            name: 'Payment Methods',
            hash: 'setting-payment-methods',
            icon: <CreditCard />,
          },
          {
            name: 'Delivery Dates',
            hash: 'setting-delivery-dates',
            icon: <Package />,
          },
          {
            name: 'Subscriptions', // الجديد: إعدادات الاشتراكات
            hash: 'setting-subscriptions',
            icon: <Star />,
          },
          {
            name: 'Subscription Plans', // الجديد: إدارة خطط الاشتراكات
            hash: '/admin/subscriptions',
            icon: <Star className="mr-2" />,
            isExternal: true,
          },
          {
            name: 'Points Settings',
            hash: 'setting-points',
            icon: <PointerIcon />,
          },
                    {
            name: 'Ai Assistant Settings',
            hash: 'setting-ai-assistant',
            icon: <Bot/>,
          },
        ].map((item) => (
          <Button
            key={item.hash}
            variant={active === item.hash ? 'outline' : 'ghost'}
            className={`justify-start ${
              active === item.hash ? '' : 'border border-transparent'
            }`}
            onClick={() =>
              item.isExternal
                ? handleExternalLink(item.hash)
                : handleScroll(item.hash)
            }
          >
            {item.icon}
            {item.name}
          </Button>
        ))}
      </nav>
    </div>
  )
}

export default SettingNav