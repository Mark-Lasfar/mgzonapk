'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

const scopeDescriptions: Record<string, string> = {
  'profile:read': 'Read your profile information (name, email, nickname)',
  'profile:write': 'Modify your profile information',
  'products:read': 'View your products',
  'products:write': 'Create or modify products',
  'orders:read': 'View your orders',
  'orders:write': 'Create or modify orders',
  'customers:read': 'View customer data',
  'customers:write': 'Create or modify customer data',
  'inventory:read': 'View inventory data',
  'inventory:write': 'Modify inventory data',
  'analytics:read': 'View analytics data',
  'user:email': 'Access your GitHub email address',
  'repo': 'Access your GitHub repositories',
};

interface ConsentClientProps {
  clientId: string | null;
  redirectUri: string | null;
  state: string | null;
  clientName: string;
  scopes: string[];
  error: string | null;
  locale: string;
  onConsent: (selectedScopes: string[]) => Promise<string>;
  onCancel: () => Promise<string>;
}

export default function ConsentClient({
  clientId,
  redirectUri,
  state,
  clientName,
  scopes,
  error: initialError,
  locale,
  onConsent,
  onCancel,
}: ConsentClientProps) {
  const t = useTranslations('Consent');
  const router = useRouter();
  const [selectedScopes, setSelectedScopes] = useState<string[]>(scopes);
  const [error, setError] = useState<string | null>(initialError);
  const [loading, setLoading] = useState<boolean>(false);

  const handleConsent = async () => {
    if (!clientId || !redirectUri) {
      setError(t('errors.missingParams'));
      return;
    }

    try {
      setLoading(true);
      const redirectUrl = await onConsent(selectedScopes);
      router.push(redirectUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.unknown'));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    try {
      setLoading(true);
      const redirectUrl = await onCancel();
      router.push(redirectUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.unknown'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('title', { appName: clientName })}</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <p className="mb-4">{t('description', { appName: clientName })}</p>

          <h3 className="text-lg font-semibold mb-2">{t('scopes')}</h3>
          <div className="mb-4">
            {scopes.map((scope) => (
              <div key={scope} className="flex items-center space-x-2 mb-2">
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
                <Label htmlFor={`scope-${scope}`}>
                  {scope} - {scopeDescriptions[scope] || 'Unknown scope'}
                </Label>
              </div>
            ))}
          </div>

          <div className="flex justify-between">
            <Button variant="destructive" onClick={handleCancel} disabled={loading}>
              {t('cancel')}
            </Button>
            <Button onClick={handleConsent} disabled={loading}>
              {t('approve')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}