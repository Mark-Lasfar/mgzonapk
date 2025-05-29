import { Metadata } from 'next';
import { auth } from '@/auth';
import { getPODDesigns } from '@/lib/actions/pod.actions';
import DesignList from './design-list';
import { notFound } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Print on Demand Designs',
};

export default async function PODDesigns({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/${(await params).locale}/sign-in`);
  }

  const resolvedSearchParams = await searchParams;
  const page = Number(resolvedSearchParams.page) || 1;
  const { data } = await getPODDesigns(session.user.id, { page });

  if (!data) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Print on Demand Designs</h1>
      <DesignList designs={data.designs} totalPages={data.totalPages} page={page} />
    </div>
  );
}