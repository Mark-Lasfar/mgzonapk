// /app/[locale]/(root)/account/subscriptions/redeem-points/page.tsx

import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import RedeemPointsClient from './RedeemPointsClient';
import { ApolloClient, InMemoryCache, gql, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { auth } from '@/auth';
import fetch from 'cross-fetch'; 

export default async function RedeemPointsPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: { planId?: string };
}) {
  const { locale } = params;
  const { planId } = searchParams;
  const t = await getTranslations({ locale, namespace: 'subscriptions' });

  const session = await auth();
  const userId = session?.user?.id;
  const token = session?.user?.token;

  if (!userId) return notFound();

  if (!planId) {
    return (
      <div className="max-w-6xl mx-auto p-4">
        <h1 className="h1-bold py-4">{t('errors.invalidPlan')}</h1>
      </div>
    );
  }

  // إعداد Apollo Client مع Authorization Header
  const httpLink = createHttpLink({
    uri: `${process.env.NEXT_PUBLIC_BASE_URL}/graphql`,
    fetch,
  });

  const authLink = setContext((_, { headers }) => ({
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    },
  }));

  const client = new ApolloClient({
    link: authLink.concat(httpLink),
    cache: new InMemoryCache(),
  });

  try {
    const { data } = await client.query({
      query: gql`
        query GetPlanAndSeller($planId: ID!, $userId: ID!) {
          subscriptionPlan(id: $planId) {
            id
            name
            pointsCost
          }
          sellerSubscription(userId: $userId) {
            pointsBalance
          }
        }
      `,
      variables: { planId, userId },
    });

    if (!data?.subscriptionPlan || !data?.sellerSubscription) {
      return (
        <div className="max-w-6xl mx-auto p-4">
          <h1 className="h1-bold py-4">{t('errors.invalidPlan')}</h1>
        </div>
      );
    }

    return (
      <RedeemPointsClient
        seller={data.sellerSubscription}
        plan={data.subscriptionPlan}
        userId={userId}
        locale={locale}
      />
    );
  } catch (error) {
    console.error('Error fetching plan or seller:', error);
    return (
      <div className="max-w-6xl mx-auto p-4">
        <h1 className="h1-bold py-4">{t('errors.serverError')}</h1>
      </div>
    );
  }
}
