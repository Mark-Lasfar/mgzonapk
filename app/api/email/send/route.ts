// /home/mark/Music/my-nextjs-project-clean/app/api/email/send/route.ts
import { NextResponse } from 'next/server';
import { emailService } from '@/lib/services/email';
import { z } from 'zod';

const EmailSchema = z.object({
  type: z.enum(['verification', 'order', 'password_reset', 'subscription', 'payment_failed']),
  to: z.string().email(),
  name: z.string().optional(),
  code: z.string().optional(),
  order: z
    .object({
      _id: z.string(),
      items: z.array(
        z.object({
          name: z.string(),
          quantity: z.number(),
          price: z.number(),
        })
      ).optional(),
      totalPrice: z.number(),
    })
    .optional(),
  resetToken: z.string().optional(),
  plan: z.string().optional(),
  amount: z.number().optional(),
  currency: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validatedData = EmailSchema.parse(body);

    switch (validatedData.type) {
      case 'verification':
        if (!validatedData.code || !validatedData.name) {
          return NextResponse.json({ error: 'Code and name are required for verification email' }, { status: 400 });
        }
        await emailService.sendVerificationCode({
          to: validatedData.to,
          code: validatedData.code,
          name: validatedData.name,
        });
        break;
      case 'order':
        if (!validatedData.order || !validatedData.name) {
          return NextResponse.json({ error: 'Order and name are required for order confirmation' }, { status: 400 });
        }
        await emailService.sendOrderConfirmation({
          to: validatedData.to,
            _order: validatedData.order,
          get order() {
              return this._order;
          },
          set order(value) {
              this._order = value;
          },
          user: { name: validatedData.name },
        });
        break;
      case 'password_reset':
        if (!validatedData.resetToken || !validatedData.name) {
          return NextResponse.json({ error: 'Reset token and name are required for password reset' }, { status: 400 });
        }
        await emailService.sendPasswordReset({
          to: validatedData.to,
          resetToken: validatedData.resetToken,
          name: validatedData.name,
        });
        break;
      case 'subscription':
        if (!validatedData.plan || !validatedData.amount || !validatedData.currency || !validatedData.name) {
          return NextResponse.json({ error: 'Plan, amount, currency, and name are required for subscription confirmation' }, { status: 400 });
        }
        await emailService.sendSubscriptionConfirmation({
          to: validatedData.to,
          name: validatedData.name,
          plan: validatedData.plan,
          amount: validatedData.amount,
          currency: validatedData.currency,
          email: validatedData.to,
        });
        break;
      case 'payment_failed':
        if (!validatedData.order || !validatedData.name) {
          return NextResponse.json({ error: 'Order and name are required for payment failure email' }, { status: 400 });
        }
        await emailService.sendPaymentFailure({
          to: validatedData.to,
          order: validatedData.order,
          user: { name: validatedData.name },
        });
        break;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send email' },
      { status: 500 }
    );
  }
}