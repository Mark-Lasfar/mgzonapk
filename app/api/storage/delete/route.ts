import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { auth } from '@/auth';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const deleteSchema = z.object({
  publicId: z.string(),
});

export async function POST(req: NextRequest) {
  try {
    const locale = req.headers.get('x-locale') || 'en';
    const t = await getTranslations({ locale, namespace: 'Storage' });
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: t('errors.unauthorized') }, { status: 401 });
    }

    const body = await req.json();
    const { publicId } = deleteSchema.parse(body);

    await cloudinary.uploader.destroy(publicId, { invalidate: true });

    return NextResponse.json({ success: true, message: t('success.fileDeleted') });
  } catch (error) {
    const locale = req.headers.get('x-locale') || 'en';
    const t = await getTranslations({ locale, namespace: 'Storage' });
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : t('errors.deleteFailed') },
      { status: 500 }
    );
  }
}