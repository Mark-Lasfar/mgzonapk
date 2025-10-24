import { auth } from '@/auth';
import { getTranslations } from 'next-intl/server';
import { OAuthService } from '@/lib/api/services/oauth.service';
import ConsentClient from './ConsentClient';
import { redirect } from 'next/navigation';

const userPermissions = ['profile:read', 'profile:write'];
const sellerPermissions = [
  'profile:read', 'profile:write',
  'products:read', 'products:write',
  'orders:read', 'orders:write',
  'customers:read', 'customers:write',
  'inventory:read', 'inventory:write',
  'analytics:read',
];

export default async function ConsentPage({
  params: { locale },
  searchParams,
}: {
  params: { locale: string };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const t = await getTranslations({ locale, namespace: 'Consent' });
  const session = await auth();

  const clientId = typeof searchParams.client_id === 'string' ? searchParams.client_id : null;
  const redirectUri = typeof searchParams.redirect_uri === 'string' ? searchParams.redirect_uri : null;
  const state = typeof searchParams.state === 'string' ? searchParams.state : null;
  let clientName = 'Unknown App';
  let scopes: string[] = [];
  let error: string | null = null;

  if (!session?.user?.id) {
    redirect('/sign-in');
  }

  if (!clientId) {
    error = t('errors.missingClientId');
  } else {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/clients/${clientId}`, {
        headers: {
          Authorization: `Bearer ${session.user.token}`,
        },
      });
      const clientData = await response.json();
      if (response.ok) {
        clientName = clientData.data?.name || 'Unknown App';
        const requestedScopes = typeof searchParams.scope === 'string' ? searchParams.scope.split(' ') : [];

        // التحقق من الصلاحيات بناءً على دور المستخدم
        const isSeller = session.user.role === 'SELLER';
        const allowedPermissions = isSeller ? sellerPermissions : userPermissions;
        const forbiddenScopes = requestedScopes.filter((scope: string) => !allowedPermissions.includes(scope));

        if (forbiddenScopes.length > 0) {
          error = t('errors.forbiddenScopes', { scopes: forbiddenScopes.join(', ') });
        } else {
          scopes = requestedScopes;
        }
      } else {
        error = t('errors.invalidClient');
      }
    } catch (err) {
      error = t('errors.unknown');
    }
  }

  const handleConsent = async (selectedScopes: string[]) => {
    'use server';
    const session = await auth();
    if (!session?.user?.id) {
      redirect('/sign-in');
    }

    if (!clientId || !redirectUri) {
      throw new Error(t('errors.missingParams'));
    }

    // التحقق من الصلاحيات المختارة
    const isSeller = session.user.role === 'SELLER';
    const allowedPermissions = isSeller ? sellerPermissions : userPermissions;
    const forbiddenScopes = selectedScopes.filter((scope: string) => !allowedPermissions.includes(scope));

    if (forbiddenScopes.length > 0) {
      throw new Error(t('errors.forbiddenScopes', { scopes: forbiddenScopes.join(', ') }));
    }

    const code = await OAuthService.generateAuthCode({
      clientId,
      userId: session.user.id,
      redirectUri,
      scopes: selectedScopes,
    });

    const redirectUrl = new URL(redirectUri);
    redirectUrl.searchParams.set('code', code);
    if (state) {
      redirectUrl.searchParams.set('state', state);
    }

    return redirectUrl.toString();
  };

  const handleCancel = async () => {
    'use server';
    const redirectUrl = new URL(redirectUri || '/');
    redirectUrl.searchParams.set('error', 'access_denied');
    if (state) {
      redirectUrl.searchParams.set('state', state);
    }
    return redirectUrl.toString();
  };

  return (
    <ConsentClient
      clientId={clientId}
      redirectUri={redirectUri}
      state={state}
      clientName={clientName}
      scopes={scopes}
      error={error}
      locale={locale}
      onConsent={handleConsent}
      onCancel={handleCancel}
    />
  );
}