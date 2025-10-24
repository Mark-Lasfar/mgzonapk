// /app/[locale]/[customSiteUrl]/store/[customSiteUrl].tsx
'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import axios from 'axios';
import ProductCard from '@/components/shared/product/product-card';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

interface StoreData {
  settings: { customSite: { logo?: string; bannerImage?: string; primaryColor?: string; customSections?: Array<{ title: string; slug: string; content: string; type: string }> } };
  template: { heroConfig: { title: string; subtitle: string }; layout: string[] };
  products: any[];
}

export default function VendorStore({ params }: { params: { customSiteUrl: string; locale: string } }) {
  const t = useTranslations('Store');
  const router = useRouter();
  const [storeData, setStoreData] = useState<StoreData | null>(null);

  useEffect(() => {
    async function fetchStoreData() {
      try {
        const [storeResponse, productsResponse] = await Promise.all([
          axios.get(`/api/stores/${params.customSiteUrl}/template`),
          axios.get(`/api/seller/products?seller=${params.customSiteUrl}`),
        ]);
        setStoreData({
          settings: storeResponse.data.data.settings,
          template: storeResponse.data.data.template,
          products: productsResponse.data.products,
        });
      } catch (error) {
        console.error('Error fetching store data:', error);
        router.push(`/${params.locale}/404`);
      }
    }
    fetchStoreData();
  }, [params.customSiteUrl, params.locale, router]);

  if (!storeData) return <div>{t('loading')}</div>;

  return (
    <div style={{ backgroundColor: storeData.settings.customSite.primaryColor || '#fff' }}>
      {storeData.settings.customSite.logo && (
        <Image src={storeData.settings.customSite.logo} alt="Store Logo" width={100} height={100} />
      )}
      {storeData.settings.customSite.bannerImage && (
        <Image
          src={storeData.settings.customSite.bannerImage}
          alt="Banner"
          width={1200}
          height={300}
          className="w-full"
        />
      )}
      <h1>{storeData.template.heroConfig.title || t('defaultTitle')}</h1>
      <p>{storeData.template.heroConfig.subtitle || t('defaultSubtitle')}</p>
      {storeData.settings.customSite.customSections?.map((section, index) => (
        <div key={index} className="my-4">
          <h2>{section.title}</h2>
          {section.type === 'products' ? (
            <div className="grid grid-cols-3 gap-4">
              {storeData.products.map((product: any) => (
                <ProductCard key={product._id} product={product} />
              ))}
            </div>
          ) : (
            <div dangerouslySetInnerHTML={{ __html: section.content }} />
          )}
        </div>
      ))}
    </div>
  );
}