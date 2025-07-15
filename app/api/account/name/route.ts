import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { updateUserName } from '@/lib/actions/user.actions';

export async function PATCH(req: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { name } = await req.json();

  if (typeof name !== 'string' || name.trim() === '') {
    return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
  }

  try {
    const res = await updateUserName({ name });
    if (!res.success) {
      return NextResponse.json({ error: res.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update name' }, { status: 500 });
  }
}
