'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Session } from 'next-auth';
import { Copy, RotateCcw, Trash2, Key } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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

interface ApiKeyResponse {
  success: boolean;
  data?: any;
  error?: string;
}

interface APIKeyClientProps {
  initialApiKeys: ApiKey[];
  initialApps: ClientApplication[];
  initialError: string | null;
  session: Session | null;
  locale: string;
}

const availablePermissions = [
  'profile:read',
  'profile:write',
  'products:read',
  'products:write',
  'orders:read',
  'orders:write',
  'customers:read',
  'customers:write',
  'inventory:read',
  'inventory:write',
  'analytics:read',
];

const availableScopes = [
  'profile:read',
  'profile:write',
  'products:read',
  'products:write',
  'orders:read',
  'orders:write',
  'customers:read',
  'customers:write',
  'inventory:read',
  'inventory:write',
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
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['profile:read']);
  const [customScope, setCustomScope] = useState('');
  const [customScopes, setCustomScopes] = useState<string[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(false);

  const isSeller = session?.user?.role === 'SELLER';
  const apiEndpoint = isSeller ? '/api/seller/apikeys' : '/api/user/apikeys';

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
          'Authorization': `Bearer ${session.user.token}`,
          'Accept-Language': locale,
        },
      });
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

  useEffect(() => {
    fetchApiKeys();
  }, [session, locale]);

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
          'Authorization': `Bearer ${session.user.token}`,
          'Accept-Language': locale,
        },
        body: JSON.stringify({
          name: newKeyName,
          permissions: selectedPermissions,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || t('errors.failedToCreateApiKey'));
      }

      setApiKeys([...apiKeys, result.data]);
      setNewKeyName('');
      setSelectedPermissions(['profile:read']);
      setError(null);
      toast({
        title: t('success.created'),
        description: t('success.createdMessage', { name: newKeyName }),
      });
      if (result.data?.key) {
        navigator.clipboard.writeText(result.data.key);
        toast({
          title: t('success.keyCopied'),
          description: t('success.keyCopiedMessage'),
        });
      }
      await fetchApiKeys();
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
          'Authorization': `Bearer ${session.user.token}`,
          'Accept-Language': locale,
        },
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || t('errors.rotationFailed'));
      }

      toast({
        title: t('success.rotated'),
        description: t('success.rotatedMessage'),
      });
      if (result.data?.key) {
        navigator.clipboard.writeText(result.data.key);
        toast({
          title: t('success.keyCopied'),
          description: t('success.keyCopiedMessage'),
        });
      }
      await fetchApiKeys();
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
          'Authorization': `Bearer ${session.user.token}`,
          'Accept-Language': locale,
        },
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || t('errors.deleteFailed'));
      }

      toast({
        title: t('success.deleted'),
        description: t('success.deletedMessage'),
      });
      await fetchApiKeys();
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

  const createApp = async () => {
    if (!newAppName || !newRedirectUri) {
      setError(t('errors.nameAndRedirectRequired'));
      return;
    }

    if (!session?.user?.id || !session?.user?.token) {
      setError(t('errors.notAuthenticated'));
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/user/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.user.token}`,
          'Accept-Language': locale,
        },
        body: JSON.stringify({
          name: newAppName,
          redirectUris: [newRedirectUri],
          scopes: selectedScopes,
          customScopes,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || t('errors.failedToCreateApp'));
      }

      setApps([...apps, result.data]);
      setNewAppName('');
      setNewRedirectUri('');
      setSelectedScopes(['profile:read']);
      setCustomScopes([]);
      setCustomScope('');
      setError(null);
      toast({
        title: t('success.appCreated'),
        description: t('success.appCreatedMessage'),
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

  const addCustomScope = () => {
    if (customScope && /^[a-zA-Z0-9:]+$/.test(customScope) && !customScopes.includes(customScope)) {
      setCustomScopes([...customScopes, customScope]);
      setCustomScope('');
    } else {
      setError(t('errors.invalidCustomScope'));
    }
  };

  return (
    <div className="max-w-4xl mx-auto mt-10 p-4">
      <h1 className="text-2xl font-bold mb-4">{t('apiKeysAndApps')}</h1>

      {error && (
        <div className="mb-4">
          <Alert variant="destructive">
            <AlertDescription>{t(`errors.${error}`) || error}</AlertDescription>
          </Alert>
        </div>
      )}

      <h2 className="text-xl font-bold mb-2">{t('createApiKey')}</h2>
      <div className="space-y-4 p-4 border rounded-lg">
        <Input
          value={newKeyName}
          onChange={(e) => setNewKeyName(e.target.value)}
          placeholder={t('apiKeyNamePlaceholder')}
          disabled={loading}
        />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-40 overflow-y-auto p-2 border rounded">
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
              <Label htmlFor={`perm-${perm}`} className="text-sm">
                {perm}
              </Label>
            </div>
          ))}
        </div>
        <Button onClick={createApiKey} disabled={loading || !newKeyName.trim()} className="w-full">
          {loading ? (
            <>
              <Key className="mr-2 h-4 w-4 animate-spin" />
              {t('creating')}
            </>
          ) : (
            <>
              <Key className="mr-2 h-4 w-4" />
              {t('createApiKey')}
            </>
          )}
        </Button>
      </div>

      <div className="mt-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">{t('existingKeys')}</h2>
          <Button
            variant="outline"
            onClick={fetchApiKeys}
            disabled={loadingKeys}
            size="sm"
          >
            {loadingKeys ? t('refreshing') : t('refresh')}
          </Button>
        </div>

        {loadingKeys ? (
          <div className="text-center py-8">{t('loading')}</div>
        ) : apiKeys.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {t('noKeys')}
          </div>
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
                        onClick={() => rotateApiKey(key.id)}
                        disabled={loading || !key.isActive}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deactivateApiKey(key.id)}
                        disabled={loading}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <h2 className="text-xl font-bold mb-2 mt-8">{t('createOauthApp')}</h2>
      <div className="space-y-4 p-4 border rounded-lg">
        <Input
          value={newAppName}
          onChange={(e) => setNewAppName(e.target.value)}
          placeholder={t('appNamePlaceholder')}
          disabled={loading}
        />
        <Input
          value={newRedirectUri}
          onChange={(e) => setNewRedirectUri(e.target.value)}
          placeholder={t('redirectUriPlaceholder')}
          disabled={loading}
        />
        <div className="mb-4">
          <Label>{t('scopes')}</Label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-40 overflow-y-auto p-2 border rounded">
            {availableScopes.map((scope) => (
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
                <Label htmlFor={`scope-${scope}`} className="text-sm">
                  {scope}
                </Label>
              </div>
            ))}
          </div>
        </div>
        <div className="mb-4">
          <Label>{t('customScopes')}</Label>
          <div className="flex gap-2">
            <Input
              value={customScope}
              onChange={(e) => setCustomScope(e.target.value)}
              placeholder={t('customScopePlaceholder')}
              disabled={loading}
            />
            <Button onClick={addCustomScope} disabled={loading}>
              {t('addCustomScope')}
            </Button>
          </div>
          {customScopes.length > 0 && (
            <ul className="mt-2">
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
        <Button onClick={createApp} disabled={loading || !newAppName.trim() || !newRedirectUri.trim()}>
          {loading ? t('submitting') : t('createApp')}
        </Button>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-bold mb-2">{t('oauthApps')}</h2>
        {apps.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">{t('noAppsFound')}</div>
        ) : (
          <ul className="mt-4">
            {apps.map((app) => (
              <li key={app.id} className="border p-2 rounded mb-2">
                <strong>{app.name}</strong>
                <div>Client ID: <span className="font-mono">{app.clientId}</span></div>
                <div>Client Secret: <span className="font-mono">{app.clientSecret}</span></div>
                <div>Redirect URIs: {app.redirectUris.join(', ')}</div>
                <div>Scopes: {app.scopes.join(', ')}</div>
                {app.customScopes && app.customScopes.length > 0 && (
                  <div>Custom Scopes: {app.customScopes.join(', ')}</div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}