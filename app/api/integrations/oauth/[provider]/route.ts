   import { NextRequest, NextResponse } from 'next/server';
   import { connectToDatabase } from '@/lib/db';
   import { auth } from '@/auth';
   import Integration from '@/lib/db/models/integration.model';
   import { logger } from '@/lib/api/services/logging';
   import { v4 as uuidv4 } from 'uuid';
   import { decrypt } from '@/lib/utils/encryption';

   export async function GET(req: NextRequest, { params }: { params: { provider: string } }) {
     const requestId = uuidv4();
     try {
       const session = await auth();
       if (!session?.user?.id || session.user.role !== 'SELLER') {
         logger.warn('Unauthorized access attempt', { requestId });
         return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
       }

       const { searchParams } = new URL(req.url);
       const sandbox = searchParams.get('sandbox') === 'true';
       const provider = params.provider;

       await connectToDatabase(sandbox ? 'sandbox' : 'live');
       const integration = await Integration.findOne({ providerName: provider }).lean();
       if (!integration || !integration.oauth.enabled) {
         logger.warn('Invalid or non-OAuth integration', { requestId, provider });
         return NextResponse.json({ error: 'Invalid or non-OAuth integration' }, { status: 400 });
       }

       const clientId = integration.settings.clientId;
       const clientSecret = integration.settings.clientSecret;
       if (!clientId || !clientSecret) {
         logger.error('Missing OAuth credentials', { requestId, provider });
         return NextResponse.json({ error: 'Missing OAuth credentials' }, { status: 400 });
       }

       const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/integrations/${integration._id}/callback?sandbox=${sandbox}`;
       const authUrl = new URL(integration.oauth.authorizationUrl!);
       authUrl.searchParams.append('client_id', clientId);
       authUrl.searchParams.append('redirect_uri', redirectUri);
       authUrl.searchParams.append('response_type', 'code');
       authUrl.searchParams.append('scope', integration.oauth.scopes?.join(' ') || '');
       authUrl.searchParams.append('state', uuidv4());

       logger.info('OAuth initiated for provider', { requestId, provider, sandbox });
       return NextResponse.redirect(authUrl.toString());
     } catch (error) {
       const errorMessage = error instanceof Error ? error.message : String(error);
       logger.error('Failed to initiate OAuth', { requestId, error: errorMessage });
       return NextResponse.json({ error: errorMessage }, { status: 500 });
     }
   }