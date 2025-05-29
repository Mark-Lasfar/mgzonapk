'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useTranslations, useLocale } from 'next-intl';

export default function VerifyCodePage() {
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();
  const { toast } = useToast();
  const t = useTranslations('Auth');
  const locale = useLocale();
  const isArabic = locale === 'ar';
  const direction = isArabic ? 'rtl' : 'ltr';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, email }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.setItem('verifiedEmail', email);
        toast({ description: t('VerificationSuccess') });
        router.push('/auth/complete-registration');
      } else {
        setError(data.error || t('InvalidCode'));
        toast({ description: data.error || t('InvalidCode'), variant: 'destructive' });
      }
    } catch (err) {
      setError(t('Error'));
      toast({ description: t('Error'), variant: 'destructive' });
    }
  };

  return (
    <main className="max-w-md mx-auto py-8" style={{ direction }}>
      <Card>
        <CardHeader>
          <CardTitle>{t('VerifyEmail')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">{t('Email')}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t('EmailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="code">{t('VerificationCode')}</Label>
              <Input
                id="code"
                type="text"
                placeholder={t('CodePlaceholder')}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-red-500">{error}</p>}
            <Button type="submit" className="w-full">
              {t('Verify')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}