import { NextRequest, NextResponse } from 'next/server';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { z } from 'zod';
import { connectToDatabase } from '@/lib/db';
import mongoose from 'mongoose';

// Reuse the integrationSchema from the integrations route
const integrationSchema = z.object({
  providerName: z.string().min(2).regex(/^[\w\s-]+$/),
  type: z.enum([
    'payment', 'warehouse', 'dropshipping', 'marketplace', 'shipping', 'marketing', 'accounting',
    'crm', 'analytics', 'automation', 'communication', 'education', 'security', 'advertising', 'tax', 'other',
  ]),
  description: z.string().max(500).optional(),
  logoUrl: z.string().url().optional().or(z.literal('')),
  isActive: z.boolean().default(true),
  sandbox: z.boolean().default(false),
credentials: z.record(z.string().min(1, 'Credential value is required')).optional(),
endpoints: z.record(z.string().url('Invalid URL').or(z.literal(''))).optional(),
apiEndpoints: z.record(z.string().url('Invalid URL').or(z.literal(''))).optional(),
  webhook: z.object({
    enabled: z.boolean().default(false),
    url: z.string().url().optional().or(z.literal('')),
    secret: z.string().optional(),
    events: z.array(z.string()).optional(),
  }).optional(),
  settings: z.object({
    supportedCurrencies: z.array(z.string().regex(/^[A-Z]{3}$/)).optional(),
    supportedCountries: z.array(z.string().regex(/^[A-Z]{2}$/)).optional(),
    amountMultiplier: z.number().min(0).default(1),
    apiUrl: z.string().url().optional().or(z.literal('')),
    authType: z.enum(['Bearer', 'Basic', 'APIKey', 'OAuth']).optional(),
    clientId: z.string().optional(),
    clientSecret: z.string().optional(),
  }).optional(),
  pricing: z.object({
    isFree: z.boolean().default(true),
    commissionRate: z.number().min(0).max(1).optional(),
    requiredPlanIds: z.array(z.string()).optional(),
  }).optional(),
  videos: z.array(
    z.object({
      url: z.string().url(),
      position: z.enum(['left', 'center', 'right']).default('center'),
      size: z.enum(['small', 'medium', 'large']).default('medium'),

      fontSize: z.string().default('16px'),
      fontFamily: z.string().default('Arial'),
      margin: z.string().default('10px'),
      padding: z.string().default('10px'),
      customPosition: z.object({
        position: z.enum(['absolute', 'relative', 'fixed']).default('relative'),
        top: z.string().default('0px'),
        left: z.string().default('0px'),
      }).optional(),
    })
  ).optional(),
  images: z.array(
    z.object({
      url: z.string().url(),
      position: z.enum(['left', 'center', 'right']).default('center'),
      size: z.enum(['small', 'medium', 'large']).default('medium'),

      fontSize: z.string().default('16px'),
      fontFamily: z.string().default('Arial'),
      margin: z.string().default('10px'),
      padding: z.string().default('10px'),
      customPosition: z.object({
        position: z.enum(['absolute', 'relative', 'fixed']).default('relative'),
        top: z.string().default('0px'),
        left: z.string().default('0px'),
      }).optional(),
    })
  ).optional(),
  articles: z.array(
    z.object({
      title: z.string().min(2),
      content: z.string().min(10),
      fontSize: z.string().default('16px'),
      fontFamily: z.string().default('Arial'),
      margin: z.string().default('10px'),
      padding: z.string().default('10px'),
    })
  ).optional(),
  buttons: z.array(
    z.object({
      label: z.string().min(2),
      link: z.string().url(),
      type: z.enum(['primary', 'secondary', 'link']).default('primary'),
      backgroundColor: z.string().default('#000000'),
      textColor: z.string().default('#ffffff'),
      borderRadius: z.string().default('4px'),
      padding: z.string().default('8px 16px'),
    })
  ).optional(),
  dividers: z.array(
    z.object({
      style: z.string().default('solid 1px gray'),
    })
  ).optional(),
  autoRegister: z.object({
    enabled: z.boolean().default(false),
    fields: z.array(
      z.object({
        key: z.string().min(1),
        label: z.string().min(1),
        type: z.enum(['text', 'email', 'password', 'number']).default('text'),
        required: z.boolean().default(true),
      })
    ).optional(),
  }).optional(),
});


export async function POST(req: NextRequest) {
  const locale = req.nextUrl.searchParams.get('locale') || 'en';
  const t = await getTranslations({ locale, namespace: 'admin integrations add' });
  const session = await auth();

  if (!session?.user?.id || session.user.role !== 'Admin') {
    return NextResponse.json(
      { success: false, message: t('errors.unauthorized') },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const validatedData = integrationSchema.parse(body);

    await connectToDatabase();
    const sessionDb = await mongoose.startSession();
    sessionDb.startTransaction();

    try {
      const previewId = crypto.randomUUID();
      const previewData = {
        ...validatedData,
        _id: previewId,
        createdBy: session.user.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // تنتهي صلاحيته بعد يوم
      };

      await mongoose.model('PreviewIntegration').create([previewData], { session: sessionDb });

      await sessionDb.commitTransaction();
      const previewUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/preview/integration/${previewId}`;
      return NextResponse.json({ success: true, previewUrl });
    } catch (error) {
      await sessionDb.abortTransaction();
      throw error;
    } finally {
      sessionDb.endSession();
    }
  } catch (error: any) {
    console.error('Error generating preview:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          message: t('errors.invalidData'),
          errors: error.errors.map((err) => ({
            path: err.path.join('.'),
            message: err.message,
          })),
        },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, message: error.message || t('error.server') },
      { status: 500 }
    );
  }
}