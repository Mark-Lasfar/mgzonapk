import { auth } from '@/auth';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { OAuthService } from '@/lib/api/services/oauth.service';
import ConsentClient from './ConsentClient';
import { USER_PERMISSIONS, SELLER_PERMISSIONS } from '@/lib/constants/permissions';
import Client from '@/lib/db/models/client.model';
import { connectToDatabase } from '@/lib/db';

export default async function ConsentPage({
  params: { locale },
  searchParams,
}: {
  params: { locale: string };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const t = await getTranslations({ locale, namespace: 'Consent' });
  const session = await auth();

  const clientId = searchParams.client_id as string | undefined;
  const redirectUri = searchParams.redirect_uri as string | undefined;
  const state = searchParams.state as string | undefined;
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
      await connectToDatabase('live');
      const client = await Client.findOne({ clientId }).lean();
      if (client) {
        clientName = client.name || 'Unknown App';
        const requestedScopes = (searchParams.scope as string)?.split(' ') || [];

        // التحقق من الصلاحيات بناءً على دور المستخدم
        const isSeller = session.user.role === 'SELLER';
        const allowedPermissions = isSeller ? SELLER_PERMISSIONS : USER_PERMISSIONS;
        const forbiddenScopes = requestedScopes.filter((scope: string) => !allowedPermissions.includes(scope));

        if (forbiddenScopes.length > 0) {
          error = t('errors.forbiddenScopes', { scopes: forbiddenScopes.join(', ') });
        } else {
          // التحقق من redirectUri
          if (redirectUri && !client.redirectUris.includes(redirectUri)) {
            error = t('errors.invalidRedirectUri');
          } else {
            scopes = requestedScopes;
          }
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
    if (!clientId || !redirectUri) {
      throw new Error(t('errors.missingParams'));
    }

    // التحقق من الصلاحيات المختارة
    const isSeller = session.user.role === 'SELLER';
    const allowedPermissions = isSeller ? SELLER_PERMISSIONS : USER_PERMISSIONS;
    const forbiddenScopes = selectedScopes.filter((scope: string) => !allowedPermissions.includes(scope));

    if (forbiddenScopes.length > 0) {
      throw new Error(t('errors.forbiddenScopes', { scopes: forbiddenScopes.join(', ') }));
    }

    // التحقق من redirectUri
    await connectToDatabase('live');
    const client = await Client.findOne({ clientId }).lean();
    if (!client || (redirectUri && !client.redirectUris.includes(redirectUri))) {
      throw new Error(t('errors.invalidRedirectUri'));
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

  const handleCancel = () => {
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
      clientId={clientId ?? null}
      redirectUri={redirectUri ?? null}
      state={state ?? null}
      clientName={clientName}
      scopes={scopes}
      error={error}
      locale={locale}
      onConsent={handleConsent}
      onCancel={handleCancel}
    />
  );
}