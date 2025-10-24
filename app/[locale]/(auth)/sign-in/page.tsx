// /home/mark/Music/my-nextjs-project-clean/app/[locale]/(auth)/sign-in/page.tsx

'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Card, CardContent } from '@/components/ui/card';
import { useForm } from 'react-hook-form';
import { IUserSignIn } from '@/types';
import { signInWithCredentials } from '@/lib/actions/user.actions';
import { zodResolver } from '@hookform/resolvers/zod';
import { UserSignInSchema } from '@/lib/validator';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { GoogleSignInForm } from './google-signin-form';
import useSettingStore from '../../../../hooks/use-setting-store';
import { toast } from '../../../../hooks/use-toast';
import { useSession } from 'next-auth/react'; // استيراد useSession

const SeparatorWithOr = () => (
  <div className="relative my-4">
    <div className="absolute inset-0 flex items-center">
      <span className="w-full border-t" />
    </div>
    <div className="relative flex justify-center text-xs uppercase">
      <span className="bg-background px-2 text-muted-foreground">Or</span>
    </div>
  </div>
);

const signInDefaultValues =
  process.env.NODE_ENV === 'development'
    ? {
        email: 'admin@mgzon.com',
        password: 'elasfar691458',
      }
    : {
        email: '',
        password: '',
      };

const allowedPaths = [
  '/seller/registration',
  '/cart',
  '/checkout',
  '/account',
  '/',
];

export default function CredentialsSignInForm() {
  const {
    setting: { site },
  } = useSettingStore();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const { data: session, status } = useSession(); // استخدام useSession للحصول على CSRF token

  const error = searchParams?.get('error');
  if (error) {
    console.log('SignIn: Error from search params:', error);
    toast({
      title: 'Error',
      description:
        error === 'CredentialsSignin'
          ? 'Invalid authentication method. Try signing in with Google.'
          : error === 'MissingCSRF'
          ? 'CSRF token missing. Please refresh the page and try again.'
          : 'An error occurred during sign-in. Please try again.',
      variant: 'destructive',
    });
  }

  const rawCallbackUrl = searchParams?.get('callbackUrl') || '/';
  const callbackUrl = allowedPaths.some((path) =>
    rawCallbackUrl.startsWith(path)
  )
    ? rawCallbackUrl
    : '/';

  const form = useForm<IUserSignIn>({
    resolver: zodResolver(UserSignInSchema),
    defaultValues: signInDefaultValues,
  });

  const { control, handleSubmit } = form;

  const onSubmit = async (data: IUserSignIn) => {
    try {
      setIsLoading(true);
      console.log('SignIn: Submitting credentials for email:', data.email);

      // إضافة CSRF token إلى الطلب
      const csrfToken = session?.csrfToken || (await fetch('/api/auth/csrf').then((res) => res.json())).csrfToken;
      console.log('SignIn: CSRF token:', csrfToken);

      const result = await signInWithCredentials({
        email: data.email,
        password: data.password,
        csrfToken, // تمرير CSRF token
      });
      console.log('SignIn: signInWithCredentials result:', result);

      if (!result.success) {
        if (result.requiresVerification) {
          console.log('SignIn: Verification required for email:', data.email);
          router.push(`/verify-code?email=${encodeURIComponent(data.email)}`);
          toast({
            title: 'Verification Required',
            description: result.error || 'Please verify your email',
          });
          return;
        }
        console.log('SignIn: Authentication failed:', result.error);
        throw new Error(result.error || 'Authentication failed');
      }

      console.log('SignIn: Success, redirecting to:', result.redirect || callbackUrl);
      router.push(result.redirect || callbackUrl);
    } catch (error) {
      console.error('SignIn: Error:', error);
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Invalid email or password',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto mt-10">
      <h1 className="text-2xl font-bold mb-4">Sign In</h1>
      <Card>
        <CardContent>
          <div>
            <Form {...form}>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <input type="hidden" name="callbackUrl" value={callbackUrl} />
                {/* إضافة حقل CSRF المخفي */}
                <input
                  type="hidden"
                  name="csrfToken"
                  value={session?.csrfToken || ''} // استخدام CSRF token من الجلسة
                />

                <FormField
                  control={control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter email address"
                          type="email"
                          autoComplete="email"
                          disabled={isLoading}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Enter password"
                          autoComplete="current-password"
                          disabled={isLoading}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="text-sm text-right">
                  <Link
                    href="/reset-password"
                    className="text-primary hover:underline"
                  >
                    Forgot Password?
                  </Link>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </Button>

                <div className="text-sm text-muted-foreground">
                  By signing in, you agree to {site.name}'s{' '}
                  <Link
                    href="/page/conditions-of-use"
                    className="text-primary hover:underline"
                  >
                    Conditions of Use
                  </Link>{' '}
                  and{' '}
                  <Link
                    href="/page/privacy-policy"
                    className="text-primary hover:underline"
                  >
                    Privacy Notice
                  </Link>
                  .
                </div>
              </form>
            </Form>

            <SeparatorWithOr />

            <div className="mt-4">
              <GoogleSignInForm />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6">
        <h2 className="text-lg font-bold mb-4">Quick Links</h2>
        <ul className="space-y-2">
          <li>
            <Link href="/docs/oauth">
              <Button variant="outline" className="w-full">
                Docs as a Developer
              </Button>
            </Link>
          </li>
          <li>
            <Link href="/seller/registration">
              <Button variant="outline" className="w-full">
                Register as a Seller
              </Button>
            </Link>
          </li>
          <li>
            <Link href="/account/APIKEY">
              <Button variant="outline" className="w-full">
                API Key Management
              </Button>
            </Link>
          </li>
          <li>
            <Link href="/seller/dashboard/integrations">
              <Button variant="outline" className="w-full">
                Integrations & API Dashboard
              </Button>
            </Link>
          </li>
          <li>
            <Link href="/support/tickets/create">
              <Button variant="outline" className="w-full">
                Help & Documentation
              </Button>
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}