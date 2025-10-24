'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, RotateCcw, Trash2, Key } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ApiKey {
  id: string;
  name: string;
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
}

interface ApiKeysManagerProps {
  userId: string;
  locale: string;
}

export default function ApiKeysManager({ userId, locale }: ApiKeysManagerProps) {
  const t = useTranslations('securityapiKeys');
  const { toast } = useToast();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(['products:read', 'orders:read']);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNewKey, setShowNewKey] = useState(false);

  const availablePermissions = [
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

  const fetchApiKeys = async () => {
    setLoadingKeys(true);
    setError(null);
    try {
      const response = await fetch('/api/seller/apikeys', {
        headers: {
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
  }, [userId, locale]);

  const handleCreateApiKey = async () => {
    if (!newKeyName.trim()) {
      toast({
        title: t('errors.nameRequired'),
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/seller/apikeys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept-Language': locale },
        body: JSON.stringify({ name: newKeyName.trim(), permissions: selectedPermissions }),
      });
      const result: ApiKeyResponse & { data?: { id: string; key: string } } = await response.json();
      if (result.success) {
        toast({
          title: t('success.created'),
          description: t('success.createdMessage', { name: newKeyName }),
        });
        setNewKeyName('');
        setSelectedPermissions(['products:read', 'orders:read']);
        setShowNewKey(true);
        if (result.data?.key) {
          navigator.clipboard.writeText(result.data.key);
          toast({
            title: t('success.keyCopied'),
            description: t('success.keyCopiedMessage'),
          });
        }
        await fetchApiKeys();
      } else {
        throw new Error(result.error || t('errors.createFailed'));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('errors.createFailed');
      setError(errorMessage);
      toast({
        title: t('errors.createFailed'),
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRotateApiKey = async (apiKeyId: string) => {
    if (!confirm(t('confirm.rotate'))) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/seller/apikeys?action=rotate&apiKeyId=${apiKeyId}`, {
        method: 'PATCH',
        headers: { 'Accept-Language': locale },
      });
      const result = await response.json();
      if (result.success) {
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
      } else {
        throw new Error(result.error || t('errors.rotationFailed'));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('errors.rotationFailed');
      toast({
        title: t('errors.rotationFailed'),
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeactivateApiKey = async (apiKeyId: string) => {
    if (!confirm(t('confirm.delete'))) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/seller/apikeys?apiKeyId=${apiKeyId}`, {
        method: 'DELETE',
        headers: { 'Accept-Language': locale },
      });
      const result = await response.json();
      if (result.success) {
        toast({
          title: t('success.deleted'),
          description: t('success.deletedMessage'),
        });
        await fetchApiKeys();
      } else {
        throw new Error(result.error || t('errors.deleteFailed'));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('errors.deleteFailed');
      toast({
        title: t('errors.deleteFailed'),
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePermissionChange = (permission: string, checked: boolean) => {
    setSelectedPermissions(prev =>
      checked ? [...prev, permission] : prev.filter(p => p !== permission)
    );
  };

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4 p-4 border rounded-lg">
        <h3 className="text-lg font-semibold">{t('createNewKey')}</h3>
        <div className="space-y-3">
          <Input
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder={t('namePlaceholder')}
            disabled={isLoading}
          />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-40 overflow-y-auto p-2 border rounded">
            {availablePermissions.map((perm) => (
              <div key={perm} className="flex items-center space-x-2">
                <Checkbox
                  id={perm}
                  checked={selectedPermissions.includes(perm)}
                  onCheckedChange={(checked) => handlePermissionChange(perm, !!checked)}
                  disabled={isLoading}
                />
                <Label htmlFor={perm} className="text-sm">
                  {perm}
                </Label>
              </div>
            ))}
          </div>
          <Button
            onClick={handleCreateApiKey}
            disabled={isLoading || !newKeyName.trim()}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Key className="mr-2 h-4 w-4 animate-spin" />
                {t('creating')}
              </>
            ) : (
              <>
                <Key className="mr-2 h-4 w-4" />
                {t('createKey')}
              </>
            )}
          </Button>
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">{t('existingKeys')}</h3>
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
                        onClick={() => handleRotateApiKey(key.id)}
                        disabled={isLoading || !key.isActive}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeactivateApiKey(key.id)}
                        disabled={isLoading}
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
    </div>
  );
}