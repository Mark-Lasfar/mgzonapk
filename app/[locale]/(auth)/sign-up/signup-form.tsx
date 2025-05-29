'use client';
import { useState, useEffect } from 'react';
import { redirect, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import useSettingStore from '@/hooks/use-setting-store';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { IUserSignUp } from '@/types';
import { registerUser, signInWithCredentials, verifyEmail } from '@/lib/actions/user.actions';
import { toast } from '@/hooks/use-toast';
import { zodResolver } from '@hookform/resolvers/zod';
import { UserSignUpSchema } from '@/lib/validator';
import { Separator } from '@/components/ui/separator';
import { isRedirectError } from 'next/dist/client/components/redirect-error';

const signUpDefaultValues =
  process.env.NODE_ENV === 'development'
    ? {
        name: 'john doe',
        email: 'john@me.com',
        password: '123456',
        confirmPassword: '123456',
        phone: '1234567890',
      }
    : {
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        phone: '',
      };

export default function SignUpForm() {
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userData, setUserData] = useState<IUserSignUp | null>(null);
  const [isResending, setIsResending] = useState(false);
  
  const {
    setting: { site },
  } = useSettingStore();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';

  const form = useForm<IUserSignUp>({
    resolver: zodResolver(UserSignUpSchema),
    defaultValues: signUpDefaultValues,
  });

  const { control, handleSubmit, formState: { isSubmitting } } = form;

  useEffect(() => {
    const pendingRegistration = sessionStorage.getItem('pendingRegistration');
    if (pendingRegistration) {
      const { email, data } = JSON.parse(pendingRegistration);
      setIsVerifying(true);
      setUserEmail(email);
      setUserData(data);
    }
  }, []);

  const onSubmit = async (data: IUserSignUp) => {
    try {
      const res = await registerUser(data);
      if (!res.success) {
        toast({
          title: 'Error',
          description: res.error,
          variant: 'destructive',
        });
        return;
      }

      setIsVerifying(true);
      setUserEmail(data.email);
      setUserData(data);
      
      // Store registration data in session storage
      sessionStorage.setItem('pendingRegistration', JSON.stringify({
        email: data.email,
        data: data
      }));
      
      toast({
        title: 'Verification Required',
        description: 'Please check your email for the verification code',
      });
    } catch (error) {
      if (isRedirectError(error)) {
        throw error;
      }
      toast({
        title: 'Error',
        description: 'Registration failed. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleVerification = async () => {
    try {
      const res = await verifyEmail(userEmail, verificationCode);
      if (!res.success) {
        toast({
          title: 'Error',
          description: res.error || 'Verification failed',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Success',
        description: 'Email verified successfully',
      });

      // Get stored registration data
      const pendingRegistration = sessionStorage.getItem('pendingRegistration');
      if (!pendingRegistration) {
        redirect('/sign-in');
        return;
      }

      const { data } = JSON.parse(pendingRegistration);
      
      // Clean up stored data
      sessionStorage.removeItem('pendingRegistration');

      // Sign in automatically
      const signInRes = await signInWithCredentials({
        email: data.email,
        password: data.password
      });

      if (signInRes.success) {
        toast({
          title: 'Success',
          description: 'Email verified successfully. Signing you in...',
        });
        redirect(callbackUrl);
      } else {
        toast({
          title: 'Error',
          description: signInRes.error || 'Please sign in manually',
        });
        redirect('/sign-in');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Verification failed. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleResendCode = async () => {
    if (!userData || isResending) return;

    setIsResending(true);
    try {
      const res = await registerUser(userData);
      if (res.success) {
        toast({
          title: 'Code Resent',
          description: 'Please check your email for the new verification code',
        });
      } else {
        toast({
          title: 'Error',
          description: res.error || 'Failed to resend code',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to resend code',
        variant: 'destructive',
      });
    }
    setIsResending(false);
  };

  if (isVerifying) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Verify Your Email</h2>
          <p className="text-gray-600 mb-4">
            Please enter the verification code sent to {userEmail}
          </p>
        </div>
        <div className="space-y-4">
          <Input
            type="text"
            placeholder="Enter verification code"
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value)}
            className="text-center text-lg tracking-wider"
            maxLength={6}
          />
          <Button 
            onClick={handleVerification} 
            className="w-full"
            disabled={!verificationCode || verificationCode.length !== 6}
          >
            Verify Email
          </Button>
          <p className="text-sm text-center text-gray-500">
            Didn't receive the code?{' '}
            <button
              onClick={handleResendCode}
              className="text-primary hover:underline"
              disabled={isResending}
            >
              {isResending ? 'Sending...' : 'Resend Code'}
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        
        <FormField
          control={control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter full name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="Enter email address" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone Number</FormLabel>
              <FormControl>
                <Input placeholder="Enter phone number" {...field} />
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
                <Input type="password" placeholder="Enter password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="Confirm password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Creating Account...' : 'Sign Up'}
        </Button>

        <div className="text-sm text-gray-600">
          By creating an account, you agree to {site.name}&apos;s{' '}
          <Link href="/page/conditions-of-use" className="text-primary hover:underline">
            Conditions of Use
          </Link>{' '}
          and{' '}
          <Link href="/page/privacy-policy" className="text-primary hover:underline">
            Privacy Notice
          </Link>
          .
        </div>

        <Separator />

        <div className="text-sm text-center">
          Already have an account?{' '}
          <Link
            className="text-primary hover:underline"
            href={`/sign-in?callbackUrl=${callbackUrl}`}
          >
            Sign In
          </Link>
        </div>
      </form>
    </Form>
  );
}