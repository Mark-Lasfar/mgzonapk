'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useSession } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';

const EmailSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
});

export default function EmailPage() {
  const router = useRouter();
  const { data: session, update } = useSession();
  const form = useForm<z.infer<typeof EmailSchema>>({
    resolver: zodResolver(EmailSchema),
    defaultValues: {
      email: session?.user?.email ?? '',
    },
  });
  const { toast } = useToast();

  async function onSubmit(values: z.infer<typeof EmailSchema>) {
    try {
      const res = await fetch('/api/account/email', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      const data = await res.json();

      if (!res.ok) {
        return toast({
          variant: 'destructive',
          description: data.error || 'Failed to update email',
        });
      }

      // تحديث الجلسة بالإيميل الجديد
      const newSession = {
        ...session,
        user: {
          ...session?.user,
          email: values.email,
        },
      };
      await update(newSession);

      toast({
        description: 'Email updated successfully',
      });

      router.push('/account/manage');
    } catch (error) {
      toast({
        variant: 'destructive',
        description: 'Unexpected error occurred. Please try again.',
      });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5 max-w-md">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-bold">New Email</FormLabel>
              <FormControl>
                <Input placeholder="Email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={form.formState.isSubmitting} size="lg" className="w-full">
          {form.formState.isSubmitting ? 'Submitting...' : 'Save Changes'}
        </Button>
      </form>
    </Form>
  );
}
