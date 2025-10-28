import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { auth } from '@/auth';
import { getStorageConfig, STORAGE_CONFIG } from '@/lib/config/storage.config';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const uploadSchema = z.object({
  folder: z.string().optional(),
  public_id: z.string().optional(),
  resource_type: z.enum(['image', 'video', 'raw', 'auto']).optional(),
  maxSize: z.number().optional(),
  allowedFormats: z.array(z.string()).optional(),
  sellerId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const locale = req.headers.get('x-locale') || 'en';
    const t = await getTranslations({ locale, namespace: 'Storage' });
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: t('errors.unauthorized') }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const options = JSON.parse(formData.get('options') as string);

    const validatedOptions = uploadSchema.parse(options);

    if (!file) {
      return NextResponse.json({ success: false, error: t('errors.noFile') }, { status: 400 });
    }

    const storageConfig = validatedOptions.sellerId
      ? await getStorageConfig(validatedOptions.sellerId)
      : STORAGE_CONFIG;

    const resourceType = validatedOptions.resource_type || 'auto';
    let allowedFormats: string[] = [];
    let allowedMimeTypes: string[] = [];
    let maxSize = validatedOptions.maxSize || storageConfig.image.maxFileSize;

    switch (resourceType) {
      case 'image':
        allowedFormats = ['png', 'jpg', 'jpeg', 'webp'];
        allowedMimeTypes = storageConfig.image.allowedTypes || ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        maxSize = maxSize || storageConfig.image.maxFileSize;
        break;
      case 'video':
        allowedFormats = ['mp4', 'webm'];
        allowedMimeTypes = storageConfig.video.allowedTypes || ['video/mp4', 'video/webm'];
        maxSize = maxSize || storageConfig.video.maxFileSize;
        break;
      case 'raw':
        allowedFormats = ['pdf', 'csv'];
        allowedMimeTypes = storageConfig.document.allowedTypes || ['application/pdf', 'text/csv'];
        maxSize = maxSize || storageConfig.document.maxFileSize;
        break;
      default:
        allowedFormats = ['png', 'jpg', 'jpeg', 'webp', 'mp4', 'webm', 'pdf', 'csv'];
        allowedMimeTypes = [
          ...storageConfig.image.allowedTypes,
          ...storageConfig.video.allowedTypes,
          ...storageConfig.document.allowedTypes,
          ...storageConfig.audio.allowedTypes,
          'text/csv',
        ];
        maxSize = maxSize || storageConfig.image.maxFileSize;
    }

    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: t('errors.fileSizeExceeds', { max: (maxSize / (1024 * 1024)).toFixed(2) }) },
        { status: 400 }
      );
    }

    if (!allowedMimeTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: t('errors.invalidFileType', { types: allowedMimeTypes.join(', ') }) },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const uploadOptions = {
      folder: validatedOptions.folder || storageConfig.products.path,
      public_id: validatedOptions.public_id || `product-${Date.now()}`,
      resource_type: resourceType,
      overwrite: true,
      allowed_formats: allowedFormats,
      transformation:
        resourceType === 'image'
          ? [
              { quality: storageConfig.image.compressionQuality || 'auto' },
              { fetch_format: 'auto' },
              { width: 1200, height: 1200, crop: 'limit' },
            ]
          : resourceType === 'video'
          ? [
              { quality: storageConfig.video.transcoding.qualities[0] || 'auto' },
              { format: storageConfig.video.transcoding.formats[0] || 'mp4' },
            ]
          : undefined,
    };

    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
        if (error) reject(new Error(`Cloudinary upload failed: ${error.message}`));
        else resolve(result);
      });
      uploadStream.end(buffer);
    });

    const { secure_url: secureUrl, public_id: publicId } = uploadResult as {
      secure_url: string;
      public_id: string;
    };

    if (!secureUrl || !publicId) {
      return NextResponse.json({ success: false, error: t('errors.invalidUploadResponse') }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: { secureUrl, publicId } });
  } catch (error) {
    const locale = req.headers.get('x-locale') || 'en';
    const t = await getTranslations({ locale, namespace: 'Storage' });
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : t('errors.uploadFailed') },
      { status: 500 }
    );
  }
}