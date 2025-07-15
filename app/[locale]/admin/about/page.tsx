import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';

interface AboutData {
  intro: {
    title: string;
    description: string;
    integrationsDescription: string;
  };
  developers: Array<{ name: string; role: string; email: string; image: string }>;
  contactInfo: { email: string; socialLinks: string[] };
}

export default async function AboutManagementPage({
  params,
}: {
  params: { locale: string };
}) {
  const t = await getTranslations({ locale: params.locale, namespace: 'About' });
  const session = await auth();

  // Redirect if not admin
  if (!session || session.user.role !== 'Admin') {
    redirect(`/${params.locale}/`);
  }

  // Fetch initial data
  let aboutData: AboutData | null = null;
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/about`, {
      cache: 'no-store',
    });
    if (response.ok) {
      const { data } = await response.json();
      aboutData = data;
    }
  } catch (error) {
    console.error('Failed to fetch about data:', error);
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>{t('Title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={async (formData: FormData) => {
              'use server';
              try {
                const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/about`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    intro: {
                      title: formData.get('title'),
                      description: formData.get('description'),
                      integrationsDescription: formData.get('integrationsDescription'),
                    },
                  }),
                });
                if (!response.ok) throw new Error('Failed to update');
                return { success: true, message: 'About content updated' };
              } catch (error) {
                return { success: false, message: 'Error updating content' };
              }
            }}
            className="space-y-4"
          >
            <div>
              <label htmlFor="title" className="block text-sm font-medium">
                Title
              </label>
              <Input
                id="title"
                name="title"
                defaultValue={aboutData?.intro.title || ''}
                placeholder="Enter title"
              />
            </div>
            <div>
              <label htmlFor="description" className="block text-sm font-medium">
                Description
              </label>
              <Textarea
                id="description"
                name="description"
                defaultValue={aboutData?.intro.description || ''}
                placeholder="Enter description"
              />
            </div>
            <div>
              <label htmlFor="integrationsDescription" className="block text-sm font-medium">
                Integrations Description
              </label>
              <Textarea
                id="integrationsDescription"
                name="integrationsDescription"
                defaultValue={aboutData?.intro.integrationsDescription || ''}
                placeholder="Enter integrations description"
              />
            </div>
            <Button type="submit">Save Changes</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}