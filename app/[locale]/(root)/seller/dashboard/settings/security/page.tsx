'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { getSellerApiKeys, createSellerApiKey, rotateSellerApiKey, deactivateSellerApiKey } from '@/lib/actions/seller.actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ApiKey {
  _id: string;
  name: string;
  permissions: string[];
  isActive: boolean;
  lastUsed?: string;
  expiresAt?: Date;
}

export default function SecuritySettings({ userId }: { userId: string }) {
  const t = useTranslations('subscriptions.validation.settings.security');
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [permissions, setPermissions] = useState<string[]>(['products:read', 'orders:read']);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    fetchApiKeys();
  }, [userId]);

  const fetchApiKeys = async () => {
    try {
      const result = await getSellerApiKeys(userId);
      if (result.success) {
        setApiKeys(result.data);
        setError(null);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(t('errors.fetchFailed'));
    }
  };

  const handleCreateApiKey = async () => {
    if (!newKeyName) {
      setError(t('errors.nameRequired'));
      return;
    }

    try {
      const result = await createSellerApiKey(userId, newKeyName, permissions);
      if (result.success) {
        alert(t('apiKeyCreated'));
        setNewKeyName('');
        setPermissions(['products:read', 'orders:read']);
        setError(null);
        fetchApiKeys();
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(t('errors.createFailed'));
    }
  };

  const handleRotateApiKey = async (apiKeyId: string) => {
    try {
      const result = await rotateSellerApiKey(userId, apiKeyId);
      if (result.success) {
        alert(t('apiKeyRotated'));
        fetchApiKeys();
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(t('errors.rotationFailed'));
    }
  };

 fragenangebote

  const handleDeactivateApiKey = async (apiKeyId: string) => {
    try {
      const result = await deactivateSellerApiKey(userId, apiKeyId);
      if (result.success) {
        alert(t('apiKeyDeactivated'));
        fetchApiKeys();
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(t('errors.deactivationFailed'));
    }
  };

  const handlePermissionChange = (perm: string, checked: boolean) => {
    setPermissions(prev =>
      checked ? [...prev, perm] : prev.filter(p => p !== perm)
    );
  };

  return (
    <div className="space-y-6">
      <h2>{t('title')}</h2>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        <h3>{t('apiKeys')}</h3>
        <div className="space-y-4">
          <Input
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder={t('apiKeyNamePlaceholder')}
          />
          <div className="grid grid-cols-2 gap-2">
            {availablePermissions.map((perm) => (
              <div key={perm} className="flex items-center space-x-2">
                <Checkbox
                  id={perm}
                  checked={permissions.includes(perm)}
                  onCheckedChange={(checked) => handlePermissionChange(perm, !!checked)}
                />
                <Label htmlFor={perm}>{perm}</Label>
              </div>
            ))}
          </div>
          <Button onClick={handleCreateApiKey}>{t('createApiKey')}</Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('name')}</TableHead>
              <TableHead>{t('permissions')}</TableHead>
              <TableHead>{t('status')}</TableHead>
              <TableHead>{t('lastUsed')}</TableHead>
              <TableHead>{t('expiresAt')}</TableHead>
              <TableHead>{t('actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {apiKeys.map((key) => (
              <TableRow key={key._id}>
                <TableCell>{key.name}</TableCell>
                <TableCell>{key.permissions.join(', ')}</TableCell>
                <TableCell>{key.isActive ? t('active') : t('inactive')}</TableCell>
                <TableCell>{key.lastUsed ? new Date(key.lastUsed).toLocaleDateString() : '-'}</TableCell>
                <TableCell>{key.expiresAt ? new Date(key.expiresAt).toLocaleDateString() : '-'}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => handleRotateApiKey(key._id)}>
                      {t('rotate')}
                    </Button>
                    <Button variant="destructive" onClick={() => handleDeactivateApiKey(key._id)}>
                      {t('deactivate')}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}