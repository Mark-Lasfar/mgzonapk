'use client';
import { useTranslations } from 'next-intl';
import Image from 'next/image';

interface HeroProps {
  config: {
    title: string;
    subtitle: string;
    backgroundImage: string;
    primaryColor: string;
    ctaText?: string;
    ctaLink?: string;
  };
}

export default function HeroModern({ config }: HeroProps) {
  const t = useTranslations('Hero');
  return (
    <div
      className="relative py-16 text-center bg-cover bg-center"
      style={{ backgroundImage: `url(${config.backgroundImage || '/default-hero-bg.jpg'})` }}
    >
      <div className="absolute inset-0 bg-black opacity-50"></div>
      <div className="relative z-10 container mx-auto">
        <h1
          className="text-4xl md:text-5xl font-bold mb-4"
          style={{ color: config.primaryColor || '#ffffff' }}
        >
          {config.title || t('defaultTitle')}
        </h1>
        <p className="text-lg md:text-xl text-white mb-6">
          {config.subtitle || t('defaultSubtitle')}
        </p>
        {config.ctaText && config.ctaLink && (
          <a
            href={config.ctaLink}
            className="inline-block px-6 py-3 rounded-lg text-white font-semibold"
            style={{ backgroundColor: config.primaryColor || '#ff6600' }}
          >
            {config.ctaText}
          </a>
        )}
      </div>
    </div>
  );
}