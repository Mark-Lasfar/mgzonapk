
'use client';

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ApiKey {
  _id: string;
  key: string;
  name: string;
  permissions: string[];
  createdAt: string;
}

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

export default function ApiKeysPage() {
  const t = useTranslations('Admin');
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(['products:read', 'orders:read']);

  const fetchKeys = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/v1/api-keys');
      if (!response.ok) {
        throw new Error(t('errors.failedToFetchApiKeys'));
      }
      const { data } = await response.json();
      setKeys(data?.apiKeys || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.unknown'));
    } finally {
      setLoading(false);
    }
  };

  const createKey = async () => {
    if (!newKeyName) {
      setError(t('errors.nameRequired'));
      return;
    }

    try {
      const response = await fetch('/api/v1/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName, permissions: selectedPermissions }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || t('errors.failedToCreateApiKey'));
      }

      setNewKeyName('');
      setSelectedPermissions(['products:read', 'orders:read']);
      setError(null);
      await fetchKeys();
      alert(t('messages.apiKeyCreated'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.unknown'));
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  return (
    <div className="max-w-4xl mx-auto mt-10 p-4">
      <h1 className="text-2xl font-bold mb-4">{t('API Keys')}</h1>

      {error && (
        <div className="mb-4">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}

      <div className="mb-4">
        <Input
          value={newKeyName}
          onChange={(e) => setNewKeyName(e.target.value)}
          placeholder={t('sellers.searchPlaceholder')}
          className="mb-2"
        />
        <div className="mb-4">
          <Label>{t('Permissions')}</Label>
          <div className="grid grid-cols-2 gap-2">
            {availablePermissions.map((perm) => (
              <div key={perm} className="flex items-center space-x-2">
                <Checkbox
                  id={perm}
                  checked={selectedPermissions.includes(perm)}
                  onCheckedChange={(checked) => {
                    setSelectedPermissions(
                      checked
                        ? [...selectedPermissions, perm]
                        : selectedPermissions.filter((p) => p !== perm)
                    );
                  }}
                />
                <Label htmlFor={perm}>{perm}</Label>
              </div>
            ))}
          </div>
        </div>
        <Button onClick={createKey}>{t('Create New API Key')}</Button>
      </div>

      {loading ? (
        <p className="mt-4 text-gray-600">{t('Loading')}</p>
      ) : (
        <ul className="mt-4">
          {keys.length === 0 ? (
            <li className="text-gray-600">{t('No API keys found.')}</li>
          ) : (
            keys.map((key) => (
              <li key={key._id} className="border p-2 rounded mb-2">
                <strong>{key.name}</strong>: <span className="font-mono">{key.key}</span>
                <div>Permissions: {key.permissions.join(', ')}</div>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}