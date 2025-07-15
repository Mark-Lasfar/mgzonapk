'use client';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

interface FooterProps {
  config: {
    primaryColor: string;
    links: Array<{ label: string; href: string }>;
    storeName: string;
  };
}

export default function FooterMinimal({ config }: FooterProps) {
  const t = useTranslations('Footer');
  const { primaryColor, links, storeName } = config;

  return (
    <footer
      className="py-6 text-center"
      style={{ backgroundColor: primaryColor || '#333', color: '#fff' }}
    >
      <div className="container mx-auto">
        <p className="mb-4">&copy; {new Date().getFullYear()} {storeName || t('defaultStoreName')}</p>
        <div className="flex justify-center gap-4">
          {(links || []).map((link, index) => (
            <Link key={index} href={link.href} className="hover:underline">
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}