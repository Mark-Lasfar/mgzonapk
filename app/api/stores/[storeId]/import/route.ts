// /app/api/stores/[storeId]/import/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectToDatabase } from '@/lib/db';
import Store from '@/lib/db/models/store.model';
import Template from '@/lib/db/models/template.model';
import { uploadToStorage } from '@/lib/utils/cloudinary';

export async function POST(req: NextRequest, { params }: { params: { storeId: string } }) {
  try {
    const session = await auth();
    if (!session?.user?.storeId || session.user.storeId !== params.storeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    await connectToDatabase();
    const store = await Store.findOne({ storeId: params.storeId });
    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    if (file.name.endsWith('.json')) {
      const templateContent = await file.text();
      const template = JSON.parse(templateContent);
      const newTemplate = await Template.create({
        ...template,
        templateId: crypto.randomUUID(),
        createdBy: session.user.id,
      });
      await Store.updateOne({ storeId: params.storeId }, { $set: { templateId: newTemplate._id } });
      return NextResponse.json({ success: true, template: newTemplate });
    } else if (file.name.endsWith('.zip')) {
      const arrayBuffer = await file.arrayBuffer();
      const zip = await zip.loadAsync(arrayBuffer);
      const templateFile = zip.file('template.json');
      if (!templateFile) {
        return NextResponse.json({ error: 'No template.json found in ZIP' }, { status: 400 });
      }
      const templateContent = await templateFile.async('string');
      const template = JSON.parse(templateContent);

      // Upload static assets (images, CSS, JS) to Cloudinary
      const assets = await Promise.all(
        Object.keys(zip.files)
          .filter((name) => name.match(/\.(jpg|jpeg|png|css|js)$/))
          .map(async (name) => {
            const fileContent = await zip.file(name)!.async('nodebuffer');
            const { secureUrl } = await uploadToStorage(fileContent, `stores/${params.storeId}/assets`, {
              resource_type: name.match(/\.(jpg|jpeg|png)$/) ? 'image' : 'raw',
              public_id: `asset-${name}`,
            });
            return { name, url: secureUrl };
          })
      );

      const newTemplate = await Template.create({
        ...template,
        templateId: crypto.randomUUID(),
        createdBy: session.user.id,
        assets,
      });
      await Store.updateOne({ storeId: params.storeId }, { $set: { templateId: newTemplate._id } });
      return NextResponse.json({ success: true, template: newTemplate });
    }

    return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}