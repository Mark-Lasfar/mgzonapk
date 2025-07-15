import { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/about`, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Failed to fetch metadata');
    }
    const { data } = await response.json();
    return {
      title: data?.intro.title || 'About Us',
      description: data?.intro.description || 'Learn more about our mission and team',
    };
  } catch (error) {
    console.error('Error generating metadata:', error);
    return {
      title: 'About Us',
      description: 'Learn more about our mission and team',
    };
  }
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'About' });

  let about;
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/about`, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Failed to fetch about page data');
    }
    const { data } = await response.json();
    about = data;
  } catch (error) {
    console.error('Error fetching about page data:', error);
    return (
      <div className="p-6 max-w-6xl mx-auto text-center">
        <h1 className="text-4xl font-bold mb-4 text-gray-800">{t('Error.Title')}</h1>
        <p className="text-lg text-gray-700">{t('Error.Message')}</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-16">
      <section className="text-center py-16 bg-blue-50">
        <h1 className="text-4xl font-bold mb-4 text-gray-800">{about.intro.title}</h1>
        <p className="text-lg text-gray-700 max-w-2xl mx-auto">{about.intro.description}</p>
        <p className="text-lg text-gray-700 max-w-2xl mx-auto mt-6">{about.intro.integrationsDescription}</p>
      </section>

      <section className="text-center">
        <h2 className="text-2xl font-semibold mb-6">{t('Developers.Title')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 justify-items-center">
          {about.developers.map((dev: any, index: number) => (
            <div key={index} className="flex flex-col items-center space-y-2">
              <div className="relative w-[150px] h-[150px]">
                <Image
                  src={dev.image}
                  alt={dev.name}
                  width={150}
                  height={150}
                  className="object-cover w-full h-full rounded-full"
                />
              </div>
              <h3 className="text-xl font-bold">{dev.name}</h3>
              <p className="text-gray-600">{dev.role}</p>
              <p className="text-blue-600">{dev.email}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-6 text-center">{t('Partners.Title')}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 text-center">
          {about.partners.map((partner: any, index: number) => (
            <Link
              key={index}
              href={`/${locale}/partners/${partner.slug}`}
              className="transform hover:scale-105 transition-transform duration-300"
            >
              <div className="flex flex-col items-center space-y-2 shadow-md rounded-xl p-4 hover:shadow-lg bg-white">
                <div className="relative w-[100px] h-[100px]">
                  <Image
                    src={partner.image}
                    alt={partner.name}
                    width={100}
                    height={100}
                    className="object-cover w-full h-full rounded-full"
                  />
                </div>
                <p className="mt-2 font-medium">{partner.name}</p>
                <p className="text-sm text-gray-600">{partner.email}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-6 text-center">{t('Team.Title')}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 text-center">
          {about.team.map((member: any, index: number) => (
            <div key={index} className="flex flex-col items-center space-y-2">
              <div className="relative w-[100px] h-[100px]">
                <Image
                  src={member.image}
                  alt={member.name}
                  width={100}
                  height={100}
                  className="object-cover w-full h-full rounded-full"
                />
              </div>
              <p className="mt-2 font-medium">{member.name}</p>
              <p className="text-sm text-gray-600">{member.role}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-16 bg-gray-50">
        <h2 className="text-3xl font-extrabold text-center mb-4">{t('Integrations.Title')}</h2>
        <p className="mt-4 max-w-3xl mx-auto text-center text-xl text-gray-600">{about.intro.integrationsDescription}</p>
        <div className="mt-12 grid grid-cols-2 gap-8 md:grid-cols-3 lg:grid-cols-5">
          {about.integrations.map((integration: any, index: number) => (
            <a
              key={index}
              href={integration.link}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-6 bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300"
            >
              <div className="flex justify-center h-16">
                {integration.image ? (
                  <Image
                    src={integration.image}
                    alt={integration.name}
                    width={120}
                    height={40}
                    className="h-full w-auto object-contain"
                  />
                ) : (
                  <div className="bg-blue-600 text-white font-bold py-3 px-4 rounded w-full max-w-[120px] text-center">
                    {integration.name}
                  </div>
                )}
              </div>
              <p className="mt-4 text-center text-lg font-medium text-gray-900">{integration.text}</p>
            </a>
          ))}
        </div>
      </section>

      <section className="text-center">
        <h2 className="text-2xl font-semibold mb-4">{t('Contact.Title')}</h2>
        <p className="text-lg text-gray-700">{about.contactInfo.description}</p>
        <p className="text-blue-600">{about.contactInfo.email}</p>
        <div className="mt-4 flex justify-center space-x-6 text-blue-500">
          {about.contactInfo.socialLinks.map((link: string, index: number) => (
            <a key={index} href={link} target="_blank" className="hover:underline">
              {link.split('/').pop()}
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}