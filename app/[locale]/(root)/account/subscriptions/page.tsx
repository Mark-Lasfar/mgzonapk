// /home/mark/Music/my-nextjs-project-clean/app/[locale]/(root)/account/subscriptions/page.tsx
import SubscriptionsList from '@/components/account/subscriptions/SubscriptionsList';

interface SubscriptionsPageProps {
  params: Promise<{ locale: string }>;
}

export default async function SubscriptionsPage({ params }: SubscriptionsPageProps) {
  const { locale } = await params;
  return <SubscriptionsList locale={locale} />;
}