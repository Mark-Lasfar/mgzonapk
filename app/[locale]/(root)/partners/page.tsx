// /app/[locale]/(root)/partners/page.tsx
import { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export const metadata: Metadata = {
  title: 'Our Partners',
  description: 'Meet our valued partners who help us grow and succeed.',
};

export default async function PartnersPage({ params: { locale } }: { params: { locale: string } }) {
  const t = await getTranslations({ locale, namespace: 'partners' });
  const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/partners`, { cache: 'no-store' });
  const { data: partners } = await response.json();

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-16">
      <section className="text-center py-16 bg-blue-50">
        <h1 className="text-4xl font-bold mb-4 text-gray-800">{t('title')}</h1>
        <p className="text-lg text-gray-700 max-w-2xl mx-auto">{t('description')}</p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-6 text-center">{t('ourPartners')}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 text-center">
          {partners.map((partner: any) => (
            <Link
              key={partner._id}
              href={`/${locale}/partners/${partner.slug}`}
              className="transform hover:scale-105 transition-transform duration-300"
            >
              <div className="flex flex-col items-center space-y-2 shadow-md rounded-xl p-4 hover:shadow-lg bg-white">
                <div className="relative w-[100px] h-[100px]">
                  <div className="absolute inset-0 rounded-full animate-spin bg-gradient-to-tr from-yellow-400 via-pink-500 to-red-500 p-[2px]" />
                  <div className="absolute inset-0 rounded-full bg-white z-10 m-[2px]" />
                  <div className="absolute inset-0 z-20 m-[2px] rounded-full overflow-hidden">
                    <Image
                      src={partner.image}
                      alt={partner.name}
                      width={100}
                      height={100}
                      className="object-cover w-full h-full"
                    />
                  </div>
                </div>
                <p className="mt-2 font-medium">{partner.name}</p>
                <p className="text-sm text-gray-600">{partner.email}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}