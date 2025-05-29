import { NextResponse } from 'next/server';
import VerificationCode from '@/lib/db/models/verification-code.model';
import { connectToDatabase } from '@/lib/db';

export async function POST(req: Request) {
  await connectToDatabase();
  const { email, code } = await req.json();

  if (!email || !code) {
    return NextResponse.json({ error: 'Email and code are required' }, { status: 400 });
  }

  const record = await VerificationCode.findOne({ email, code });

  if (!record) {
    return NextResponse.json({ error: 'Invalid or expired code' }, { status: 401 });
  }

  if (record.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Code expired' }, { status: 401 });
  }

  return NextResponse.json({ success: true });
}
