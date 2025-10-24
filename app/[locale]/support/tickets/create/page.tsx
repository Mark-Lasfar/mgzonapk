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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import {
  Loader2,
  Info,
  Mail,
  Clock,
  HelpCircle,
  MessageCircle,
  Lightbulb,
  Send,
  Hash,
  AtSign,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

// === فئات المستخدم العادي ===
const userCategories = [
  'Order Issue',
  'Product Question',
  'Shipping',
  'Returns',
  'Technical Support',
  'Account',
  'Other',
] as const;

// === فئات البائع (محدثة حسب طلبك) ===
const vendorCategories = [
  'Integrations',
  'Pricing',
  'Create Integration',
  'Subscriptions',
  'Ads',
  'Withdrawals',
  'Payment',
  'Warehouse',
  'Dropshipping',
  'Marketplace',
  'Shipping',
  'Marketing',
  'Accounting',
  'CRM',
  'Analytics',
  'Automation',
  'Communication',
  'Education',
  'Security',
  'Advertising',
  'Tax',
  'Other',
] as const;

// === Schema ديناميكي ===
const createTicketSchema = (t: any, isVendor: boolean) =>
  z.object({
    name: z.string().min(2, { message: t('validation.name.min', { count: 2 }) }),
    email: z.string().email({ message: t('validation.email.invalid') }),
    subject: z.string().min(5).max(100),
    description: z.string().min(20).max(1000),
    category: z.string().nonempty({ message: t('validation.category.required') }),
    orderId: z.string().optional(),
    integrationId: isVendor ? z.string().optional() : z.never().optional(),
    vendorId: isVendor ? z.string().optional() : z.never().optional(),
  });

export default function CreateTicket() {
  const t = useTranslations('CreateTicket');
  const router = useRouter();
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(false);
  const [showOrderId, setShowOrderId] = useState(false);
  const [showIntegrationId, setShowIntegrationId] = useState(false);
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false);

  // === تحديد الدور ===
  const isVendor = session?.user?.role === 'vendor';
  const categories = isVendor ? vendorCategories : userCategories;

  // === النموذج الرئيسي ===
  const form = useForm<z.infer<ReturnType<typeof createTicketSchema>>>({
    resolver: zodResolver(createTicketSchema(t, isVendor)),
    defaultValues: {
      name: '',
      email: '',
      subject: '',
      description: '',
      category: '',
      orderId: '',
      integrationId: '',
      vendorId: '',
    },
  });

  // === ملء الحقول تلقائيًا ===
  useEffect(() => {
    if (session?.user) {
      form.setValue('name', session.user.name || '');
      form.setValue('email', session.user.email || '');
      if (isVendor && session.user.vendorId) {
        form.setValue('vendorId', session.user.vendorId);
      }
    }
  }, [session, form, isVendor]);

  const selectedCategory = form.watch('category');

  useEffect(() => {
    const needsOrderId = selectedCategory === 'Order Issue';
    const needsIntegrationId = isVendor && ['Integrations', 'Create Integration'].includes(selectedCategory);
    setShowOrderId(needsOrderId);
    setShowIntegrationId(needsIntegrationId);
  }, [selectedCategory, isVendor]);

  // === نموذج WhatsApp (مع الإيميل) ===
  const whatsappForm = useForm({
    defaultValues: {
      whatsappName: session?.user?.name || '',
      whatsappEmail: session?.user?.email || '',
      whatsappSubject: '',
      whatsappMessage: '',
    },
  });

  useEffect(() => {
    if (session?.user) {
      whatsappForm.setValue('whatsappName', session.user.name || '');
      whatsappForm.setValue('whatsappEmail', session.user.email || '');
    }
  }, [session, whatsappForm]);

  const onWhatsAppSubmit = (data: any) => {
    const { whatsappName, whatsappEmail, whatsappSubject, whatsappMessage } = data;
    const text = `${t('whatsapp.greeting')}\n\n${t('whatsapp.name')}: ${whatsappName}\n${t('whatsapp.email')}: ${whatsappEmail}\n${t('whatsapp.subject')}: ${whatsappSubject}\n${t('whatsapp.message')}: ${whatsappMessage}`;
    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/201212444617?text=${encoded}`, '_blank');
    setIsWhatsAppOpen(false);
    whatsappForm.reset();
  };

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          userId: session?.user?.id || data.email,
          message: data.description,
          priority: 'medium',
          role: isVendor ? 'vendor' : 'user',
        }),
      });

      if (!response.ok) throw new Error(t('errors.submitFailed'));

      toast.success(t('success.title'), {
        description: t('success.description'),
      });
      router.push('/support/tickets');
    } catch (error) {
      toast.error(t('errors.title'), {
        description: t('errors.submitFailed'),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-2 text-muted-foreground max-w-2xl mx-auto">
          {t('contact')}
        </p>
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* النموذج الرئيسي */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2"
        >
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5" />
                {t('form.title')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                  <div className="grid sm:grid-cols-2 gap-5">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('fields.name.label')}</FormLabel>
                          <FormControl>
                            <Input placeholder={t('fields.name.placeholder')} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('fields.email.label')}</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <AtSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                              <Input
                                type="email"
                                placeholder={t('fields.email.placeholder')}
                                className="pl-10"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

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
                            {categories.map((cat) => (
                              <SelectItem key={cat} value={cat}>
                                {t(`categories.${cat.toLowerCase().replace(/ /g, '_')}`)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>{t('fields.category.description')}</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* رقم الطلب */}
                  <AnimatePresence>
                    {showOrderId && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <FormField
                          control={form.control}
                          name="orderId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('fields.orderId.label')}</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Hash className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                  <Input
                                    placeholder={t('fields.orderId.placeholder')}
                                    className="pl-10"
                                    {...field}
                                  />
                                </div>
                              </FormControl>
                              <FormDescription>{t('fields.orderId.description')}</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* رقم التكامل (للبائع فقط) */}
<AnimatePresence>
  {showIntegrationId && (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3 }}
    >
      <FormField
        control={form.control}
        name="integrationId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('fields.integrationId.label')}</FormLabel>
            <FormControl>
              <div className="relative">
                <Hash className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('fields.integrationId.placeholder')}
                  className="pl-10"
                  {...field}
                />
              </div>
            </FormControl>
            <FormDescription>{t('fields.integrationId.description')}</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </motion.div>
  )}
</AnimatePresence>

                  {/* وصف المشكلة */}
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('fields.description.label')}</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder={t('fields.description.placeholder')}
                            className="min-h-32 resize-none"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>{t('fields.description.description')}</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Separator className="my-6" />

                  <div className="flex justify-between items-center">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => router.push('/support/tickets')}
                      disabled={loading}
                    >
                      {t('cancel')}
                    </Button>
                    <Button type="submit" disabled={loading} className="min-w-32">
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
        </motion.div>

        {/* Sidebar */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-6"
        >
          {/* معلومات الدعم */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Info className="h-5 w-5" />
                {t('supportInfo.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <a
                href="mailto:support@mgzon.com"
                className="flex items-center gap-2 text-primary hover:underline"
              >
                <Mail className="h-4 w-4" />
                <span>support@mgzon.com</span>
              </a>

              {/* WhatsApp Modal */}
              <Dialog open={isWhatsAppOpen} onOpenChange={setIsWhatsAppOpen}>
                <DialogTrigger asChild>
                  <button className="flex items-center gap-2 text-green-600 hover:underline w-full text-left">
                    <MessageCircle className="h-4 w-4" />
                    <span>+20 121 244 4617</span>
                  </button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <MessageCircle className="h-5 w-5 text-green-600" />
                      {t('whatsapp.title')}
                    </DialogTitle>
                    <DialogDescription>{t('whatsapp.description')}</DialogDescription>
                  </DialogHeader>
                  <Form {...whatsappForm}>
                    <form onSubmit={whatsappForm.handleSubmit(onWhatsAppSubmit)} className="space-y-4">
                      <FormField
                        control={whatsappForm.control}
                        name="whatsappName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('whatsapp.name')}</FormLabel>
                            <FormControl>
                              <Input placeholder={t('whatsapp.namePlaceholder')} {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={whatsappForm.control}
                        name="whatsappEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('whatsapp.email')}</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <AtSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                  type="email"
                                  placeholder={t('whatsapp.emailPlaceholder')}
                                  className="pl-10"
                                  {...field}
                                />
                              </div>
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={whatsappForm.control}
                        name="whatsappSubject"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('whatsapp.subject')}</FormLabel>
                            <FormControl>
                              <Input placeholder={t('whatsapp.subjectPlaceholder')} {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={whatsappForm.control}
                        name="whatsappMessage"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('whatsapp.message')}</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder={t('whatsapp.messagePlaceholder')}
                                className="min-h-24 resize-none"
                                {...field}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setIsWhatsAppOpen(false)}>
                          {t('cancel')}
                        </Button>
                        <Button type="submit" className="bg-green-600 hover:bg-green-700">
                          <Send className="h-4 w-4 mr-2" />
                          {t('whatsapp.send')}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>

              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>9 AM - 6 PM</span>
              </div>
            </CardContent>
          </Card>

          {/* FAQ */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <HelpCircle className="h-5 w-5" />
                FAQ
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {[
                  { q: 'faq1', a: 'faq1_answer' },
                  { q: 'faq2', a: 'faq2_answer' },
                  { q: 'faq3', a: 'faq3_answer' },
                ].map((item, i) => (
                  <AccordionItem key={i} value={`item-${i}`}>
                    <AccordionTrigger className="text-sm font-medium hover:text-primary transition-colors">
                      {t(`supportInfo.${item.q}`)}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground">
                      {t(`supportInfo.${item.a}`)}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>

          <Alert className="border-primary/20 bg-primary/5">
            <Lightbulb className="h-4 w-4 text-primary" />
            <AlertTitle className="text-sm font-medium">{t('supportInfo.tipTitle')}</AlertTitle>
            <AlertDescription className="text-sm text-muted-foreground mt-1">
              {t('supportInfo.tip')}
            </AlertDescription>
          </Alert>
        </motion.div>
      </div>
    </div>
  );
}