import { v2 as cloudinary } from 'cloudinary';
import { STORAGE_CONFIG } from '@/lib/config/storage.config';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

interface UploadOptions {
  folder?: string;
  public_id?: string;
  overwrite?: boolean;
  resource_type?: 'image' | 'video' | 'raw' | 'auto';
  maxSize?: number;
  allowedFormats?: string[];
}

export async function uploadToStorage(
  file: File | Buffer,
  path: string,
  options: UploadOptions = {}
): Promise<{ secureUrl: string; publicId: string }> {
  try {
    const buffer = file instanceof File ? Buffer.from(await file.arrayBuffer()) : file;

    const maxSize = options.maxSize || STORAGE_CONFIG.image.maxFileSize;
    if (buffer.length > maxSize) {
      throw new Error(`File size exceeds ${maxSize / (1024 * 1024)}MB limit`);
    }

    const allowedFormats = options.allowedFormats || STORAGE_CONFIG.image.allowedTypes;
    if (file instanceof File && !allowedFormats.includes(file.type)) {
      throw new Error(`Invalid file type. Allowed types: ${allowedFormats.join(', ')}`);
    }

    const uploadOptions = {
      folder: options.folder || STORAGE_CONFIG.products.path,
      public_id: options.public_id || `${Date.now()}-${path}`,
      resource_type: options.resource_type || 'auto',
      overwrite: options.overwrite ?? true,
      allowed_formats: allowedFormats,
      transformation: [
        { quality: STORAGE_CONFIG.image.compressionQuality },
        { fetch_format: 'auto' },
        { width: 1200, height: 1200, crop: 'limit' },
      ],
    };

    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
        if (error) reject(error);
        else resolve(result);
      });
      uploadStream.end(buffer);
    });

    const { secure_url: secureUrl, public_id: publicId } = uploadResult as {
      secure_url: string;
      public_id: string;
    };
    console.log(`Uploaded file to Cloudinary: ${secureUrl}`);
    return { secureUrl, publicId };
  } catch (error) {
    console.error('Upload error:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to upload file');
  }
}

export async function deleteFromStorage(publicId: string): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId, { invalidate: true });
    console.log(`Deleted file from Cloudinary: ${publicId}`);
  } catch (error) {
    console.error('Delete error:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to delete file');
  }
}

export function getPublicIdFromUrl(url: string): string {
  const urlParts = url.split('/');
  const filename = urlParts[urlParts.length - 1].split('.')[0];
  const folderPath = urlParts.slice(urlParts.indexOf('upload') + 1, -1).join('/');
  return `${folderPath}/${filename}`;
}

export const StorageUtils = {
  uploadToStorage,
  deleteFromStorage,
  getPublicIdFromUrl,
};