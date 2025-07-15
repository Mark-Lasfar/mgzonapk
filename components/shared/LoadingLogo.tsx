'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { getSetting } from '@/lib/actions/setting.actions';

export default function LoadingLogo() {
  const [site, setSite] = useState<{ name: string; logo: string } | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { site } = await getSetting();
        setSite(site);
      } catch (error) {
        console.error('Error fetching site settings:', error);
      }
    };
    fetchSettings();
  }, []);

  if (!site) return null;

  return (
    <div className="flex justify-center my-4">
      <Image
        src={site.logo}
        width={80}
        height={80}
        alt={`${site.name} logo`}
        className="animate-slow-spin rounded-full"
        style={{ maxWidth: '100%', height: 'auto' }}
      />
    </div>
  );
}
