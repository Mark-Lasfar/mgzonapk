import { v2 as cloudinary } from 'cloudinary';
import { STORAGE_CONFIG } from '@/lib/config/storage.config';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

interface UploadOptions {
  folder?: string;
  public_id?: string;
  overwrite?: boolean;
  resource_type?: 'auto' | 'image' | 'video' | 'raw';
  maxSize?: number;
  allowedFormats?: string[];
}

export async function uploadToStorage(
  file: File | Buffer,
  path: string,
  options: UploadOptions = {}
): Promise<string> {
  try {
    // Convert File to Buffer if needed
    const buffer = file instanceof File ? await file.arrayBuffer() : file;

    // Validate file size and type
    const maxSize = options.maxSize || STORAGE_CONFIG.image.maxFileSize;
    if (buffer.byteLength > maxSize) {
      throw new Error(`File size exceeds ${maxSize / (1024 * 1024)}MB limit`);
    }

    const allowedFormats = options.allowedFormats || STORAGE_CONFIG.image.allowedTypes;
    if (file instanceof File && !allowedFormats.includes(file.type)) {
      throw new Error(`Invalid file type. Allowed types: ${allowedFormats.join(', ')}`);
    }

    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder: options.folder || STORAGE_CONFIG.products.path,
            public_id: options.public_id || `${Date.now()}-${path}`,
            resource_type: options.resource_type || 'image',
            overwrite: options.overwrite ?? true,
            allowed_formats: allowedFormats,
            transformation: [
              { quality: STORAGE_CONFIG.image.compressionQuality },
              { fetch_format: 'auto' },
            ],
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        )
        .end(Buffer.from(buffer));
    });

    const secureUrl = (uploadResult as { secure_url: string }).secure_url;
    console.log(`Uploaded file to Cloudinary: ${secureUrl}`);
    return secureUrl;
  } catch (error) {
    console.error('Upload error:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to upload file');
  }
}

export async function deleteFromStorage(publicId: string): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId);
    console.log(`Deleted file from Cloudinary: ${publicId}`);
  } catch (error) {
    console.error('Delete error:', error);
    throw new Error('Failed to delete file');
  }
}

export function getPublicIdFromUrl(url: string): string {
  const urlParts = url.split('/');
  const filename = urlParts[urlParts.length - 1];
  return filename.split('.')[0];
}

export const StorageUtils = {
  uploadToStorage,
  deleteFromStorage,
  getPublicIdFromUrl,
};