'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { createTicket } from '@/lib/actions/support.actions';
// import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { useToast } from '@/components/ui/toast';

const createTicketSchema = (t: any) =>
  z.object({
    subject: z
      .string()
      .min(5, t('validation.subject.min', { count: 5 }))
      .max(100, t('validation.subject.max', { count: 100 })),
    description: z
      .string()
      .min(20, t('validation.description.min', { count: 20 }))
      .max(1000, t('validation.description.max', { count: 1000 })),
    category: z.string({ required_error: t('validation.category.required') }),
    orderId: z.string().optional(),
  });

const categories = [
  'Order Issue',
  'Product Question',
  'Shipping',
  'Returns',
  'Technical Support',
  'Account',
  'Other',
];

export default function CreateTicket() {
  const t = useTranslations('CreateTicket');
  const { toast } = useToast();
  const router = useRouter();
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);

  // التحقق من تسجيل الدخول
  // if (!session?.user?.id) {
  //   router.push('/auth/signin');
  //   return null;
  // }

  const form = useForm<z.infer<ReturnType<typeof createTicketSchema>>>({
    resolver: zodResolver(createTicketSchema(t)),
    defaultValues: {
      subject: '',
      description: '',
      category: '',
      orderId: '',
    },
  });

  const onSubmit = async (data: z.infer<ReturnType<typeof createTicketSchema>>) => {
    setLoading(true);
    try {
      const response = await createTicket({
        ...data,
        userId: session.user.id,
      });
      if (response.success) {
        toast({
          title: t('success.title'),
          description: t('success.description'),
        });
        router.push('/support/tickets');
      } else {
        toast({
          title: t('errors.title'),
          description: response.error,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: t('errors.title'),
        description: t('errors.submitFailed'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('fields.subject.label')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('fields.subject.placeholder')} {...field} />
                    </FormControl>
                    <FormDescription>{t('fields.subject.description')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('fields.category.label')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('fields.category.placeholder')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category} value={category}>
                            {t(`categories.${category.toLowerCase().replace(' ', '_')}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>{t('fields.category.description')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('fields.description.label')}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t('fields.description.placeholder')}
                        className="h-32"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>{t('fields.description.description')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="orderId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('fields.orderId.label')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('fields.orderId.placeholder')} {...field} />
                    </FormControl>
                    <FormDescription>{t('fields.orderId.description')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/support/tickets')}
                  disabled={loading}
                >
                  {t('cancel')}
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('submitting')}
                    </>
                  ) : (
                    t('submit')
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}