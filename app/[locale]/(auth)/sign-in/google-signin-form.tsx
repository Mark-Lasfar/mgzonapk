'use client';

import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';

export function GoogleSignInForm() {
  const handleGoogleSignIn = async () => {
    try {
      await signIn('google', { callbackUrl: '/' });
    } catch (error) {
      console.error('خطأ في تسجيل الدخول بجوجل:', error);
    }
  };

  return (
    <Button
      className="w-full"
      variant="outline"
      onClick={handleGoogleSignIn}
    >
      Sign In with Google
    </Button>
  );
}