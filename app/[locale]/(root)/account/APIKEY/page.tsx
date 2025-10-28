import { auth } from '@/auth';
import APIKeyClient from './APIKeyClient';

interface ApiKey {
  id: string; 
  name: string;
  key: string;
  permissions: string[];
  isActive: boolean;
  lastUsed?: string;
  expiresAt?: string;
  createdAt: string;
}

interface ClientApplication {
  id: string; 
  name: string;
  clientId: string;
  clientSecret: string;
  redirectUris: string[];
  scopes: string[];
  customScopes?: string[];
  createdAt: string;
}


export default async function APIKeyPage({ params: { locale } }: { params: { locale: string } }) {
  const session = await auth();
  let apiKeys: ApiKey[] = [];
  let apps: ClientApplication[] = [];
  let error: string | null = null;

  console.log('APIKeyPage: Session:', session); // أضفنا لوج للتحقق

  if (session?.user?.id && session?.user?.token) {
    try {
      // Fetch API Keys
      const keysResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/keys`, {
        headers: { Authorization: `Bearer ${session.user.token}` },
      });
      if (keysResponse.ok) {
        const keysData = await keysResponse.json();
        apiKeys = keysData.data || [];
      } else {
        error = 'failedToFetchApiKeys';
        console.error('APIKeyPage: Failed to fetch API keys:', await keysResponse.text());
      }

      // Fetch OAuth Applications
      const appsResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/clients`, {
        headers: { Authorization: `Bearer ${session.user.token}` },
      });
      if (appsResponse.ok) {
        const appsData = await appsResponse.json();
        apps = appsData.data?.clients || [];
      } else {
        error = error || 'failedToFetchApps';
        console.error('APIKeyPage: Failed to fetch apps:', await appsResponse.text());
      }
    } catch (err) {
      error = 'unknown';
      console.error('APIKeyPage: Error:', err);
    }
  } else {
    error = 'notAuthenticated';
    console.error('APIKeyPage: No session or token:', { id: session?.user?.id, token: session?.user?.token });
  }

  return (
    <APIKeyClient
      initialApiKeys={apiKeys}
      initialApps={apps}
      initialError={error}
      session={session}
      locale={locale}
    />
  );
}