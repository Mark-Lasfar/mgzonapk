import { NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const credentials = await req.json();
    const user = await authenticateUser(credentials);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('Authentication error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Authentication failed' },
      { status: 500 }
    );
  }
}