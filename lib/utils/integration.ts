export function generateOAuthUrl({
    integration,
    baseUrl,
    sandbox = false,
  }: {
    integration: { _id: string; providerName: string; oauth: { enabled: boolean; authorizationUrl?: string; scopes?: string[] } };
    baseUrl: string;
    sandbox?: boolean;
  }) {
    if (!integration.oauth.enabled || !integration.oauth.authorizationUrl) {
      throw new Error('OAuth not enabled for this integration');
    }
  
    const redirectUri = `${baseUrl}/api/integrations/${integration._id}/callback?sandbox=${sandbox}`;
    const authUrl = new URL(integration.oauth.authorizationUrl);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('response_type', 'code');
    if (integration.oauth.scopes) {
      authUrl.searchParams.append('scope', integration.oauth.scopes.join(' '));
    }
    authUrl.searchParams.append('state', crypto.randomUUID());
  
    return authUrl.toString();
  }
  
  export function normalizeProviderName(name: string) {
    return name.toLowerCase().replace(/\s+/g, '-');
  }
  
  export function getIntegrationDetailUrl(providerName: string, baseUrl: string) {
    return `${baseUrl}/seller/dashboard/integrations/${normalizeProviderName(providerName)}`;
  }