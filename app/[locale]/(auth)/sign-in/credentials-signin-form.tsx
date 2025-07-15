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
import { useForm } from 'react-hook-form';
import { IUserSignIn } from '@/types';
import { signInWithCredentials } from '@/lib/actions/user.actions';
// import { toast } from '@/hooks/use-toast';
import { zodResolver } from '@hookform/resolvers/zod';
import { UserSignInSchema } from '@/lib/validator';
import { Loader2 } from 'lucide-react';
import useSettingStore from '../../../../hooks/use-setting-store';
import { toast } from '../../../../hooks/use-toast';

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

export default function CredentialsSignInForm() {
  const {
    setting: { site },
  } = useSettingStore();
  const searchParams = useSearchParams();
  const router = useRouter();
  const callbackUrl = searchParams.get('callbackUrl') || '/';

  const form = useForm<IUserSignIn>({
    resolver: zodResolver(UserSignInSchema),
    defaultValues: signInDefaultValues,
  });

  const { control, handleSubmit } = form;

  const onSubmit = async (data: IUserSignIn) => {
    try {
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
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <FormField
          control={control}
          name="email"
          render={({ field }) => (
            <FormItem className="w-full">
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="Enter email address" type="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="password"
          render={({ field }) => (
            <FormItem className="w-full">
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="Enter password"
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

        <div>
          <Button type="submit" className="w-full">
            Sign In
          </Button>
        </div>
        <div className="text-sm">
          By signing in, you agree to {site.name}'s{' '}
          <Link href="/page/conditions-of-use" className="text-primary hover:underline">
            Conditions of Use
          </Link>{' '}
          and{' '}
          <Link href="/page/privacy-policy" className="text-primary hover:underline">
            Privacy Notice.
          </Link>
        </div>
      </form>
    </Form>
  );
}