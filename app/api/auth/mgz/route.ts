import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import Client from '@/lib/db/models/client.model';
import { connectToDatabase } from '@/lib/db';
import { URL } from 'url';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const clientId = req.nextUrl.searchParams.get('client_id');
    const redirectUri = req.nextUrl.searchParams.get('redirect_uri');
    const scopes = req.nextUrl.searchParams.get('scope')?.split(' ');
    const state = req.nextUrl.searchParams.get('state');

    if (!clientId || !redirectUri || !scopes) {
      return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
    }
    

    await connectToDatabase();
    const client = await Client.findOne({ clientId, isActive: true });
    if (!client) {
      return NextResponse.json({ error: 'invalid_client' }, { status: 400 });
    }

    if (!client.redirectUris.includes(redirectUri)) {
      return NextResponse.json({ error: 'invalid_redirect_uri' }, { status: 400 });
    }

    if (!scopes.every((scope) => client.scopes.includes(scope))) {
      return NextResponse.json({ error: 'invalid_scope' }, { status: 400 });
    }

    if (!session?.user?.id) {
      const redirectUrl = new URL('/sign-in', req.url);
      redirectUrl.searchParams.set('redirect', req.url);
      return NextResponse.redirect(redirectUrl);
    }

    // Redirect to consent page
    const consentUrl = new URL('/auth/consent', req.nextUrl.origin);
    consentUrl.searchParams.set('client_id', clientId);
    consentUrl.searchParams.set('redirect_uri', redirectUri);
    consentUrl.searchParams.set('scope', scopes.join(' '));
    if (state) {
      consentUrl.searchParams.set('state', state);
    }
    return NextResponse.redirect(consentUrl);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}