'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';

export default function VerifyCodePage() {
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('Auth');
  const { toast } = useToast();

  useEffect(() => {
    const storedEmail = searchParams.get('email') || localStorage.getItem('recoveryEmail') || '';
    setEmail(storedEmail);
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, type: 'PASSWORD_RESET' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast({ title: t('success'), description: t('emailVerified') });
        router.push('/reset-password-final');
      } else {
        setMessage(data.error || t('invalidOrExpiredCode'));
        toast({ title: t('error'), description: data.error || t('invalidOrExpiredCode'), variant: 'destructive' });
      }
    } catch (error) {
      setMessage(t('verificationFailed'));
      toast({ title: t('error'), description: t('verificationFailed'), variant: 'destructive' });
    }
  };

  const handleResend = async () => {
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: email }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast({ title: t('success'), description: t('codeResent') });
      } else {
        setMessage(data.error || t('resendCodeFailed'));
        toast({ title: t('error'), description: data.error || t('resendCodeFailed'), variant: 'destructive' });
      }
    } catch (error) {
      setMessage(t('resendCodeFailed'));
      toast({ title: t('error'), description: t('resendCodeFailed'), variant: 'destructive' });
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">{t('VerifyEmail')}</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email">{t('Email')}</label>
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
          <label htmlFor="code">{t('VerificationCode')}</label>
          <Input
            id="code"
            type="text"
            placeholder={t('CodePlaceholder')}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
        </div>
        {message && <p className="text-red-500">{message}</p>}
        <Button type="submit" className="w-full bg-blue-600 text-white">
          {t('Verify')}
        </Button>
        <Button type="button" onClick={handleResend} variant="link">
          {t('resendCode')}
        </Button>
      </form>
    </div>
  );
}