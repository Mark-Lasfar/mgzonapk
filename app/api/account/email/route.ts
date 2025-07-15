import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { updateUserEmail } from '@/lib/actions/user.actions';

export async function PATCH(req: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { email } = await req.json();

  if (typeof email !== 'string' || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  }

  try {
    const res = await updateUserEmail({ email, userId: session.user.id });
    if (!res.success) {
      return NextResponse.json({ error: res.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update email' }, { status: 500 });
  }
}
