'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Session } from 'next-auth';
import { Copy, RotateCcw, Trash2, Key, Edit, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Link from 'next/link';
import Image from 'next/image';
import { ClientApplication } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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

interface ApiKeyResponse {
  success: boolean;
  data?: any;
  error?: string;
  requestId?: string;
  timestamp?: string;
}

interface APIKeyClientProps {
  initialApiKeys: ApiKey[];
  initialApps: ClientApplication[];
  initialError: string | null;
  session: Session | null;
  locale: string;
}

const userPermissions = ['profile:read', 'profile:write'];
const sellerPermissions = [
  'profile:read', 'profile:write',
  'products:read', 'products:write',
  'orders:read', 'orders:write',
  'customers:read', 'customers:write',
  'inventory:read', 'inventory:write',
  'analytics:read',
];

export default function APIKeyClient({
  initialApiKeys,
  initialApps,
  initialError,
  session,
  locale,
}: APIKeyClientProps) {
  const t = useTranslations('Account');
  const { toast } = useToast();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>(initialApiKeys);
  const [apps, setApps] = useState<ClientApplication[]>(initialApps);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(initialError);
  const [newKeyName, setNewKeyName] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(['profile:read']);
  const [newAppName, setNewAppName] = useState('');
  const [newRedirectUri, setNewRedirectUri] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newLogoUrl, setNewLogoUrl] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['profile:read']);
  const [customScope, setCustomScope] = useState('');
  const [customScopes, setCustomScopes] = useState<string[]>([]);
  const [publishToMarketplace, setPublishToMarketplace] = useState(false);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [loadingApps, setLoadingApps] = useState(false);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const isSeller = session?.user?.role === 'SELLER';
  const apiEndpoint = isSeller ? '/api/seller/apikeys' : '/api/user/apikeys';
  const clientsEndpoint = '/api/v1/clients';

  const availablePermissions = isSeller ? sellerPermissions : userPermissions;

  // Function to copy text to clipboard
  const copyKey = (keyValue: string, keyId: string) => {
    if (!window.location.protocol.includes('https') && window.location.hostname !== 'localhost') {
      toast({
        title: t('errors.copyFailed'),
        description: t('errors.copyRequiresHttps'),
        variant: 'destructive',
      });
      return;
    }
    if (!navigator.clipboard) {
      toast({
        title: t('errors.copyFailed'),
        description: t('errors.clipboardNotSupported'),
        variant: 'destructive',
      });
      return;
    }
    navigator.clipboard
      .writeText(keyValue)
      .then(() => {
        setCopiedKeyId(keyId);
        toast({
          title: t('success.keyCopied'),
          description: t('success.keyCopiedMessage'),
        });
        setTimeout(() => setCopiedKeyId(null), 2000);
      })
      .catch(() => {
        toast({
          title: t('errors.copyFailed'),
          description: t('errors.copyFailedMessage'),
          variant: 'destructive',
        });
      });
  };

  // Fetch API keys
  const fetchApiKeys = async () => {
    if (!session?.user?.id || !session?.user?.token) {
      setError(t('errors.notAuthenticated'));
      return;
    }

    setLoadingKeys(true);
    setError(null);
    try {
      const response = await fetch(apiEndpoint, {
        headers: {
          Authorization: `Bearer ${session.user.token}`,
          'Accept-Language': locale,
        },
      });
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      const result: ApiKeyResponse = await response.json();
      if (result.success) {
        setApiKeys(result.data || []);
      } else {
        throw new Error(result.error || t('errors.fetchFailed'));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('errors.fetchFailed');
      setError(errorMessage);
      toast({
        title: t('errors.fetchFailed'),
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoadingKeys(false);
    }
  };

  // Fetch OAuth clients
  const fetchClients = async () => {
    if (!session?.user?.id || !session?.user?.token) {
      setError(t('errors.notAuthenticated'));
      return;
    }

    setLoadingApps(true);
    setError(null);
    try {
      const response = await fetch(clientsEndpoint, {
        headers: {
          Authorization: `Bearer ${session.user.token}`,
          'Accept-Language': locale,
        },
      });
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      const result: ApiKeyResponse = await response.json();
      if (result.success) {
        setApps(result.data.clients || []);
      } else {
        throw new Error(result.error || t('errors.fetchClientsFailed'));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('errors.fetchClientsFailed');
      setError(errorMessage);
      toast({
        title: t('errors.fetchClientsFailed'),
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoadingApps(false);
    }
  };

  useEffect(() => {
    fetchApiKeys();
    fetchClients();
  }, [session, locale]);

  // Create API key
  const createApiKey = async () => {
    if (!newKeyName) {
      setError(t('errors.nameRequired'));
      return;
    }

    if (!session?.user?.id || !session?.user?.token) {
      setError(t('errors.notAuthenticated'));
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.user.token}`,
          'Accept-Language': locale,
        },
        body: JSON.stringify({
          name: newKeyName,
          permissions: selectedPermissions,
        }),
      });

      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      const result = await response.json();
      if (!result.success) throw new Error(result.error || t('errors.failedToCreateApiKey'));

      setApiKeys([...apiKeys, result.data]);
      setNewKeyName('');
      setSelectedPermissions(['profile:read']);
      setError(null);
      toast({
        title: t('success.created'),
        description: t('success.createdMessage', { name: newKeyName }),
      });
      if (result.data?.key) copyKey(result.data.key, result.data.id);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('errors.unknown');
      setError(errorMessage);
      toast({
        title: t('errors.failedToCreateApiKey'),
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Rotate API key
  const rotateApiKey = async (apiKeyId: string) => {
    if (!confirm(t('confirm.rotate'))) return;

    if (!session?.user?.id || !session?.user?.token) {
      setError(t('errors.notAuthenticated'));
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${apiEndpoint}?action=rotate&apiKeyId=${apiKeyId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${session.user.token}`,
          'Accept-Language': locale,
        },
      });

      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      const result = await response.json();
      if (!result.success) throw new Error(result.error || t('errors.rotationFailed'));

      setApiKeys(apiKeys.map((key) => (key.id === apiKeyId ? { ...key, ...result.data } : key)));
      toast({
        title: t('success.rotated'),
        description: t('success.rotatedMessage'),
      });
      if (result.data?.key) copyKey(result.data.key, apiKeyId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('errors.rotationFailed');
      setError(errorMessage);
      toast({
        title: t('errors.rotationFailed'),
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Deactivate API key
  const deactivateApiKey = async (apiKeyId: string) => {
    if (!confirm(t('confirm.delete'))) return;

    if (!session?.user?.id || !session?.user?.token) {
      setError(t('errors.notAuthenticated'));
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${apiEndpoint}?apiKeyId=${apiKeyId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.user.token}`,
          'Accept-Language': locale,
        },
      });

      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      const result = await response.json();
      if (!result.success) throw new Error(result.error || t('errors.deleteFailed'));

      setApiKeys(apiKeys.filter((key) => key.id !== apiKeyId));
      toast({
        title: t('success.deleted'),
        description: t('success.deletedMessage'),
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('errors.deleteFailed');
      setError(errorMessage);
      toast({
        title: t('errors.deleteFailed'),
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Add custom scope
  const addCustomScope = () => {
    if (!customScope) {
      toast({
        title: t('errors.invalidCustomScope'),
        description: t('errors.customScopeRequired'),
        variant: 'destructive',
      });
      return;
    }
    if (!/^[a-zA-Z0-9:]+$/.test(customScope)) {
      toast({
        title: t('errors.invalidCustomScope'),
        description: t('errors.invalidCustomScopeFormat'),
        variant: 'destructive',
      });
      return;
    }
    if (customScopes.includes(customScope)) {
      toast({
        title: t('errors.invalidCustomScope'),
        description: t('errors.customScopeDuplicate'),
        variant: 'destructive',
      });
      return;
    }
    setCustomScopes([...customScopes, customScope]);
    setCustomScope('');
  };

  // Create OAuth app
  const createApp = async () => {
    if (!newAppName || !newRedirectUri) {
      setError(t('errors.nameAndRedirectRequired'));
      return;
    }

    if (!/^(https?:\/\/)/.test(newRedirectUri)) {
      setError(t('errors.invalidRedirectUri'));
      return;
    }

    if (!session?.user?.id || !session?.user?.token) {
      setError(t('errors.notAuthenticated'));
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(clientsEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.user.token}`,
          'Accept-Language': locale,
        },
        body: JSON.stringify({
          name: newAppName,
          redirectUris: [newRedirectUri],
          scopes: selectedScopes,
          customScopes,
          description: newDescription,
          logoUrl: newLogoUrl,
          videos: [],
          images: [],
          buttons: [],
          features: [],
          categories: [],
          slug: newAppName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          isMarketplaceApp: publishToMarketplace,
          status: publishToMarketplace ? 'pending' : 'approved', // Correctly sets status based on isMarketplaceApp
        }),
      });

      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      const result = await response.json();
      if (!result.success) throw new Error(result.error || t('errors.failedToCreateApp'));

      setApps([...apps, result.data]);
      setNewAppName('');
      setNewRedirectUri('');
      setNewDescription('');
      setNewLogoUrl('');
      setSelectedScopes(['profile:read']);
      setCustomScopes([]);
      setCustomScope('');
      setPublishToMarketplace(false);
      setError(null);
      toast({
        title: t('success.appCreated'),
        description: publishToMarketplace
          ? t('success.appCreatedPending')
          : t('success.appCreatedMessage'),
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('errors.unknown');
      setError(errorMessage);
      toast({
        title: t('errors.failedToCreateApp'),
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Delete OAuth app
  const deleteApp = async (clientId: string) => {
    if (!confirm(t('confirm.deleteApp'))) return;

    if (!session?.user?.id || !session?.user?.token) {
      setError(t('errors.notAuthenticated'));
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${clientsEndpoint}/${clientId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.user.token}`,
          'Accept-Language': locale,
        },
      });

      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      const result = await response.json();
      if (!result.success) throw new Error(result.error || t('errors.deleteAppFailed'));

      setApps(apps.filter((app) => app.clientId !== clientId));
      toast({
        title: t('success.appDeleted'),
        description: t('success.appDeletedMessage'),
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('errors.deleteAppFailed');
      setError(errorMessage);
      toast({
        title: t('errors.deleteAppFailed'),
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Regenerate Client Secret
  const regenerateClientSecret = async (clientId: string) => {
    if (!confirm(t('confirm.regenerateClientSecret'))) return;

    if (!session?.user?.id || !session?.user?.token) {
      setError(t('errors.notAuthenticated'));
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${clientsEndpoint}/${clientId}?action=regenerate-secret`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${session.user.token}`,
          'Accept-Language': locale,
        },
      });

      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      const result = await response.json();
      if (!result.success) throw new Error(result.error || t('errors.regenerateSecretFailed'));

      setApps(apps.map((app) => (app.clientId === clientId ? { ...app, clientSecret: result.data.clientSecret } : app)));
      toast({
        title: t('success.secretRegenerated'),
        description: t('success.secretRegeneratedMessage'),
      });
      copyKey(result.data.clientSecret, clientId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('errors.regenerateSecretFailed');
      setError(errorMessage);
      toast({
        title: t('errors.regenerateSecretFailed'),
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Publish to Marketplace
  const publishToMarketplaceRequest = async (clientId: string) => {
    if (!confirm(t('confirm.publishToMarketplace'))) return;

    if (!session?.user?.id || !session?.user?.token) {
      setError(t('errors.notAuthenticated'));
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${clientsEndpoint}/${clientId}/publish`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.user.token}`,
          'Accept-Language': locale,
        },
      });

      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      const result = await response.json();
      if (!result.success) throw new Error(result.error || t('errors.publishFailed'));

      setApps(apps.map((app) => (app.clientId === clientId ? { ...app, status: 'pending', isMarketplaceApp: true } : app)));
      toast({
        title: t('success.publishRequested'),
        description: t('success.publishRequestedMessage'),
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('errors.publishFailed');
      setError(errorMessage);
      toast({
        title: t('errors.publishFailed'),
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Placeholder image for fallback
  const placeholderImage = '/placeholder.png'; // Add a placeholder image in your public folder

  return (
    <div className="max-w-5xl mx-auto mt-12 p-6">
      <h1 className="text-3xl font-bold mb-6">{t('apiKeysAndApps')}</h1>

      {error && (
        <div className="mb-6">
          <Alert variant="destructive">
            <AlertDescription>{t(`errors.${error}`) || error}</AlertDescription>
          </Alert>
        </div>
      )}

      <Card className="mb-10">
        <CardHeader>
          <CardTitle>{t('createApiKey')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder={t('apiKeyNamePlaceholder')}
            disabled={loading}
            className="text-lg"
          />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-48 overflow-y-auto p-3 border rounded-lg">
            {availablePermissions.map((perm) => (
              <div key={perm} className="flex items-center space-x-2">
                <Checkbox
                  id={`perm-${perm}`}
                  checked={selectedPermissions.includes(perm)}
                  onCheckedChange={(checked) => {
                    setSelectedPermissions(
                      checked
                        ? [...selectedPermissions, perm]
                        : selectedPermissions.filter((p) => p !== perm)
                    );
                  }}
                  disabled={loading}
                />
                <Label htmlFor={`perm-${perm}`} className="text-sm">{perm}</Label>
              </div>
            ))}
          </div>
          <Button onClick={createApiKey} disabled={loading || !newKeyName.trim()} className="w-full text-lg py-6">
            {loading ? (
              <>
                <Key className="mr-2 h-5 w-5 animate-spin" />
                {t('creating')}
              </>
            ) : (
              <>
                <Key className="mr-2 h-5 w-5" />
                {t('createApiKey')}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card className="mb-10">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>{t('existingKeys')}</CardTitle>
            <Button
              variant="outline"
              onClick={fetchApiKeys}
              disabled={loadingKeys}
              size="sm"
              className="text-sm"
            >
              {loadingKeys ? t('refreshing') : t('refresh')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingKeys ? (
            <div className="text-center py-10 text-lg text-gray-500">{t('loading')}</div>
          ) : apiKeys.length === 0 ? (
            <div className="text-center py-10 text-lg text-muted-foreground">{t('noKeys')}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('name')}</TableHead>
                  <TableHead>{t('permissions')}</TableHead>
                  <TableHead>{t('status')}</TableHead>
                  <TableHead>{t('lastUsed')}</TableHead>
                  <TableHead>{t('created')}</TableHead>
                  <TableHead>{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.name}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {key.permissions.slice(0, 3).map((perm) => (
                          <Badge key={perm} variant="secondary" className="text-xs">
                            {perm}
                          </Badge>
                        ))}
                        {key.permissions.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{key.permissions.length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={key.isActive ? 'default' : 'secondary'}>
                        {key.isActive ? t('active') : t('inactive')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {key.lastUsed ? new Date(key.lastUsed).toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell>
                      {new Date(key.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyKey(key.key, key.id)}
                          disabled={loading || !key.isActive || !key.key}
                          title={t('copyKey')}
                          className={`flex items-center gap-1 ${copiedKeyId === key.id ? 'bg-green-100 dark:bg-green-900' : ''}`}
                        >
                          <Copy className="h-4 w-4" />
                          <span>{copiedKeyId === key.id ? t('copied') : t('copyKey')}</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => rotateApiKey(key.id)}
                          disabled={loading || !key.isActive}
                          title={t('rotateKey')}
                          className="flex items-center gap-1"
                        >
                          <RotateCcw className="h-4 w-4" />
                          <span>{t('rotateKey')}</span>
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deactivateApiKey(key.id)}
                          disabled={loading}
                          title={t('deleteKey')}
                          className="flex items-center gap-1"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span>{t('deleteKey')}</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="mb-10">
        <CardHeader>
          <CardTitle>{t('createOauthApp')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            value={newAppName}
            onChange={(e) => setNewAppName(e.target.value)}
            placeholder={t('appNamePlaceholder')}
            disabled={loading}
            className="text-lg"
          />
          <Input
            value={newRedirectUri}
            onChange={(e) => setNewRedirectUri(e.target.value)}
            placeholder={t('redirectUriPlaceholder')}
            disabled={loading}
            className="text-lg"
          />
          <Input
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder={t('descriptionPlaceholder')}
            disabled={loading}
            className="text-lg"
          />
          <Input
            value={newLogoUrl}
            onChange={(e) => setNewLogoUrl(e.target.value)}
            placeholder={t('logoUrlPlaceholder')}
            disabled={loading}
            className="text-lg"
          />
          <div className="mb-4">
            <Label className="text-sm">{t('scopes')}</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-48 overflow-y-auto p-3 border rounded-lg">
              {availablePermissions.map((scope) => (
                <div key={scope} className="flex items-center space-x-2">
                  <Checkbox
                    id={`scope-${scope}`}
                    checked={selectedScopes.includes(scope)}
                    onCheckedChange={(checked) => {
                      setSelectedScopes(
                        checked
                          ? [...selectedScopes, scope]
                          : selectedScopes.filter((s) => s !== scope)
                      );
                    }}
                    disabled={loading}
                  />
                  <Label htmlFor={`scope-${scope}`} className="text-sm">{scope}</Label>
                </div>
              ))}
            </div>
          </div>
          <div className="mb-4">
            <Label className="text-sm">{t('customScopes')}</Label>
            <div className="flex gap-2">
              <Input
                value={customScope}
                onChange={(e) => setCustomScope(e.target.value)}
                placeholder={t('customScopePlaceholder')}
                disabled={loading}
                className="text-lg"
              />
              <Button onClick={addCustomScope} disabled={loading || !customScope.trim()}>
                {t('addCustomScope')}
              </Button>
            </div>
            {customScopes.length > 0 && (
              <ul className="mt-2 space-y-2">
                {customScopes.map((scope) => (
                  <li key={scope} className="flex items-center justify-between">
                    <span>{scope}</span>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setCustomScopes(customScopes.filter((s) => s !== scope))}
                      disabled={loading}
                    >
                      {t('remove')}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="publish-to-marketplace"
              checked={publishToMarketplace}
              onCheckedChange={(checked) => setPublishToMarketplace(!!checked)}
              disabled={loading}
            />
            <Label htmlFor="publish-to-marketplace" className="text-sm">
              {t('publishToMarketplace')}{' '}
              <Link href="/integrations" className="text-blue-600 hover:underline">
                {t('marketplaceLink')}
              </Link>
            </Label>
          </div>
          <Button
            onClick={createApp}
            disabled={loading || !newAppName.trim() || !newRedirectUri.trim()}
            className="w-full text-lg py-6"
          >
            {loading ? t('submitting') : t('createOauthApp')}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('oauthApps')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingApps ? (
            <div className="text-center py-12 text-xl text-gray-500">{t('loading')}</div>
          ) : apps.length === 0 ? (
            <div className="text-center py-12 text-xl text-muted-foreground">{t('noAppsFound')}</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-40">
              {apps.map((app) => (
                <Card
                  key={app.id}
                  className="min-w-[340px] max-w-[420px] rounded-xl shadow-md hover:shadow-2xl transition-shadow duration-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                >
                  <CardHeader className="p-10">
                    <div className="flex items-center gap-6">
                      {app.logoUrl && typeof app.logoUrl === 'string' && app.logoUrl.trim() ? (
                        <Image
                          src={app.logoUrl}
                          alt={app.name}
                          width={120}
                          height={120}
                          className="rounded-lg object-cover border border-gray-200 dark:border-gray-600"
                          onError={(e) => {
                            e.currentTarget.src = placeholderImage;
                            toast({
                              title: t('errors.imageLoadFailed'),
                              description: t('errors.imageLoadFailedMessage'),
                              variant: 'destructive',
                            });
                          }}
                        />
                      ) : (
                        <div className="w-28 h-28 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                          <span className="text-gray-400 text-4xl font-bold">{app.name[0]}</span>
                        </div>
                      )}
                      <Dialog>
                        <DialogTrigger asChild>
                          <CardTitle className="cursor-pointer text-2xl font-semibold hover:text-blue-500 transition-colors">
                            {app.name}
                          </CardTitle>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl p-8">
                          <DialogHeader className="flex flex-row items-center gap-6 mb-6">
                            {app.logoUrl && typeof app.logoUrl === 'string' && app.logoUrl.trim() ? (
                              <Image
                                src={app.logoUrl}
                                alt={app.name}
                                width={80}
                                height={80}
                                className="rounded-lg object-cover border border-gray-200 dark:border-gray-600"
                                onError={(e) => {
                                  e.currentTarget.src = placeholderImage;
                                  toast({
                                    title: t('errors.imageLoadFailed'),
                                    description: t('errors.imageLoadFailedMessage'),
                                    variant: 'destructive',
                                  });
                                }}
                              />
                            ) : (
                              <div className="w-20 h-20 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                                <span className="text-gray-400 text-3xl font-bold">{app.name[0]}</span>
                              </div>
                            )}
                            <DialogTitle className="text-3xl">{app.name}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-20">
                            <div className="grid grid-cols-1 gap-6">
                              <Card className="p-5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg">
                                <div className="flex items-center justify-between gap-4">
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('clientId')}</p>
                                    <p className="text-lg font-mono text-gray-800 dark:text-gray-200 mt-2 break-all">{app.clientId}</p>
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => copyKey(app.clientId, `clientId-${app.id}`)}
                                    className={`flex items-center gap-2 ${copiedKeyId === `clientId-${app.id}` ? 'bg-green-100 dark:bg-green-900' : ''}`}
                                  >
                                    <Copy className="h-4 w-4" />
                                    <span>{copiedKeyId === `clientId-${app.id}` ? t('copied') : t('copyKey')}</span>
                                  </Button>
                                </div>
                              </Card>
                              <Card className="p-5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg">
                                <div className="flex items-center justify-between gap-4">
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('clientSecret')}</p>
                                    <p className="text-lg font-mono text-gray-800 dark:text-gray-200 mt-2 break-all">{app.clientSecret}</p>
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => copyKey(app.clientSecret, `clientSecret-${app.id}`)}
                                    className={`flex items-center gap-2 ${copiedKeyId === `clientSecret-${app.id}` ? 'bg-green-100 dark:bg-green-900' : ''}`}
                                  >
                                    <Copy className="h-4 w-4" />
                                    <span>{copiedKeyId === `clientSecret-${app.id}` ? t('copied') : t('copyKey')}</span>
                                  </Button>
                                </div>
                              </Card>
                              <div>
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('description')}</p>
                                <p className="text-lg text-gray-800 dark:text-gray-200 mt-2">
                                  {app.description || t('noDescription')}
                                </p>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('status')}</p>
                                <Badge
                                  variant={
                                    app.status === 'approved' ? 'default' : app.status === 'pending' ? 'secondary' : 'destructive'
                                  }
                                  className="mt-2 px-3 py-1 text-sm"
                                >
                                  {t(`status.${app.status}`)}
                                </Badge>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('created')}</p>
                                <p className="text-lg text-gray-800 dark:text-gray-200 mt-2">
                                  {new Date(app.createdAt).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <hr className="border-gray-200 dark:border-gray-700" />
                            <div className="flex flex-wrap gap-4">
                              <Button variant="outline" asChild className="text-lg px-4 py-2">
                                <Link href={`/integrations/edit?slug=${app.slug}`} className="flex items-center gap-2">
                                  <Edit className="h-5 w-5" />
                                  {t('editApp')}
                                </Link>
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => regenerateClientSecret(app.clientId)}
                                disabled={loading}
                                className="flex items-center gap-2 text-lg px-4 py-2"
                              >
                                <RotateCcw className="h-5 w-5" />
                                {t('regenerateSecret')}
                              </Button>
                              {app.status !== 'pending' && !app.isMarketplaceApp && (
                                <Button
                                  variant="outline"
                                  onClick={() => publishToMarketplaceRequest(app.clientId)}
                                  disabled={loading}
                                  className="flex items-center gap-2 text-lg px-4 py-2"
                                >
                                  <ExternalLink className="h-5 w-5" />
                                  {t('publishToMarketplace')}
                                </Button>
                              )}
                              <Button
                                variant="destructive"
                                onClick={() => deleteApp(app.clientId)}
                                disabled={loading}
                                className="flex items-center gap-2 text-lg px-4 py-2"
                              >
                                <Trash2 className="h-5 w-5" />
                                {t('deleteApp')}
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <p className="text-gray-600 dark:text-gray-300 text-base mb-4 line-clamp-2">
                      {app.description || t('noDescription')}
                    </p>
                    <Badge
                      variant={
                        app.status === 'approved' ? 'default' : app.status === 'pending' ? 'secondary' : 'destructive'
                      }
                      className="text-sm px-3 py-1"
                    >
                      {t(`status.${app.status}`)}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}