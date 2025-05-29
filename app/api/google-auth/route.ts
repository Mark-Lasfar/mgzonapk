   'use server';

   import { NextRequest, NextResponse } from 'next/server';
   import { GoogleAuth } from 'google-auth-library';

   export async function POST(req: NextRequest) {
     try {
       const { credentials } = await req.json();
       const auth = new GoogleAuth({
         credentials,
         scopes: ['https://www.googleapis.com/auth/cloud-platform'],
       });
       const client = await auth.getClient();
       const accessToken = await client.getAccessToken();
       return NextResponse.json({ success: true, accessToken });
     } catch (error) {
       console.error('Google Auth error:', error);
       return NextResponse.json({ success: false, error: 'Authentication failed' }, { status: 500 });
     }
   }