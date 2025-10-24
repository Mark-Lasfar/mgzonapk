import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { OAuthService } from '@/lib/api/services/oauth.service';
import User from '@/lib/db/models/user.model';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessToken = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!accessToken) {
      return NextResponse.json({ error: 'Missing access token' }, { status: 401 });
    }

    const tokenData = await OAuthService.validateAccessToken(accessToken);
    if (!tokenData || tokenData.userId !== session.user.id) {
      return NextResponse.json({ error: 'Invalid access token' }, { status: 401 });
    }

    const user = await User.findById(session.user.id).select('email name profile.nickname');
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      sub: user._id.toString(),
      email: user.email,
      name: user.name || user.profile.nickname || user.email.split('@')[0],
      nickname: user.profile.nickname || user.email.split('@')[0],
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}