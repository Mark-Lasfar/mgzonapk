import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import bcrypt from 'bcryptjs';
import { updateUserPassword } from '@/lib/actions/user.actions';

export async function PATCH(req: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { currentPassword, newPassword } = await req.json();

  if (
    typeof currentPassword !== 'string' ||
    currentPassword.length < 6 ||
    typeof newPassword !== 'string' ||
    newPassword.length < 6
  ) {
    return NextResponse.json({ error: 'Invalid password(s)' }, { status: 400 });
  }

  try {
    const res = await updateUserPassword(session.user.id, currentPassword, newPassword);
    if (!res.success) {
      return NextResponse.json({ error: res.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update password' }, { status: 500 });
  }
}
