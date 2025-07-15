'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
// import useSettingStore from '@/hooks/use-setting-store';
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
// import { toast } from '@/hooks/use-toast';
import { zodResolver } from '@hookform/resolvers/zod';
import { UserSignInSchema } from '@/lib/validator';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { GoogleSignInForm } from './google-signin-form';
import useSettingStore from '../../../../hooks/use-setting-store';
import { toast } from '../../../../hooks/use-toast';

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

const signInDefaultValues = {
  email: process.env.NODE_ENV === 'development' ? 'admin@mgzon.com' : '',
  password: process.env.NODE_ENV === 'development' ? 'elasfar691458' : '',
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

  // Handle error from searchParams
  const error = searchParams?.get('error');
  if (error) {
    toast({
      title: 'Error',
      description:
        error === 'CredentialsSignin'
          ? 'Invalid authentication method. Try signing in with Google.'
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
      const result = await signInWithCredentials({
        email: data.email,
        password: data.password,
      });

      if (!result.success) {
        if (result.requiresVerification) {
          router.push(`/verify-code?email=${encodeURIComponent(data.email)}`);
          toast({
            title: 'Verification Required',
            description: result.error || 'Please verify your email',
          });
          return;
        }
        throw new Error(result.error || 'Authentication failed');
      }

      router.push(result.redirect || callbackUrl);
    } catch (error) {
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
            <Link href="/seller/registration">
              <Button variant="outline" className="w-full">
                Register as a Seller
              </Button>
            </Link>
          </li>
          <li>
            <Link href="/admin/api-keys">
              <Button variant="outline" className="w-full">
                API Key Management
              </Button>
            </Link>
          </li>
          <li>
            <Link href="/admin/integrations">
              <Button variant="outline" className="w-full">
                Integrations & API Dashboard
              </Button>
            </Link>
          </li>
          <li>
            <Link href="/help">
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