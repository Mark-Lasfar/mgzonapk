// app/[locale]/(root)/account/developers/page.tsx
import { auth } from '@/auth';
import DeveloperAppsClient from './DeveloperAppsClient';
import { redirect } from 'next/navigation';

export default async function DeveloperApplicationsPage() {
  const session = await auth();


  return (
    <DeveloperAppsClient 
      initialSession={session}
      initialUserId={session.user.id}
      initialToken={session.user.token as string}
    />
  );
}