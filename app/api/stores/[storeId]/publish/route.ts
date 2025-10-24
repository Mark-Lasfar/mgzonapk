// /app/api/stores/[storeId]/publish/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectToDatabase } from '@/lib/db';
import Store from '@/lib/db/models/store.model';
import Template from '@/lib/db/models/template.model';

export async function POST(req: NextRequest, { params }: { params: { storeId: string } }) {
  try {
    const session = await auth();
    if (!session?.user?.storeId || session.user.storeId !== params.storeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { settings, template } = await req.json();
    await connectToDatabase();

    const store = await Store.findOne({ storeId: params.storeId });
    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    let templateId = store.templateId;
    if (!templateId) {
      const newTemplate = await Template.create({
        ...template,
        templateId: crypto.randomUUID(),
        createdBy: session.user.id,
      });
      templateId = newTemplate._id;
    } else {
      await Template.updateOne({ _id: templateId }, { $set: template });
    }

    await Store.updateOne(
      { storeId: params.storeId },
      {
        $set: {
          templateId,
          'settings.customSite': settings,
        },
      }
    );

    // Trigger Vercel deployment
    const vercelToken = process.env.VERCEL_API_TOKEN;
    if (vercelToken) {
      const vercelResponse = await fetch('https://api.vercel.com/v13/deployments', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${vercelToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `store-${params.storeId}`,
          project: process.env.VERCEL_PROJECT_ID,
          target: 'production',
          gitSource: { type: 'github', repoId: process.env.VERCEL_GIT_REPO_ID },
        }),
      });
      if (!vercelResponse.ok) {
        throw new Error('Failed to trigger Vercel deployment');
      }
    }

    // Update Vercel rewrites for custom domains
    if (settings.customDomain) {
      await fetch(`https://api.vercel.com/v9/projects/${process.env.VERCEL_PROJECT_ID}/domains`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${vercelToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: settings.customDomain }),
      });
    }

    return NextResponse.json({ success: true, message: 'Store published' });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
