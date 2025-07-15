import { v2 as cloudinary } from 'cloudinary';
import { getStorageConfig, STORAGE_CONFIG } from '@/lib/config/storage.config';

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
  sellerId?: string;
  transformation?: Array<Record<string, any>>;
}

export async function uploadToStorage(
  file: File | Buffer,
  path: string,
  options: UploadOptions = {}
): Promise<{ secureUrl: string; publicId: string }> {
  try {
    const buffer = file instanceof File ? Buffer.from(await file.arrayBuffer()) : file;
    const storageConfig = options.sellerId ? await getStorageConfig(options.sellerId) : STORAGE_CONFIG;

    const resourceType = options.resource_type || 'auto';
    let allowedFormats: string[] = [];
    let allowedMimeTypes: string[] = [];
    let maxSize = options.maxSize || storageConfig.image.maxFileSize;

    // تعيين القيم الافتراضية بناءً على نوع المورد
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

    // التحقق من حجم الملف
    if (buffer.length > maxSize) {
      throw new Error(`File size exceeds ${(maxSize / (1024 * 1024)).toFixed(2)}MB limit`);
    }

    // التحقق من نوع الملف
    if (file instanceof File) {
      console.log('Uploading file:', {
        name: file.name,
        type: file.type,
        size: file.size,
      });
      if (!file.type) {
        throw new Error('File type is undefined');
      }
      if (!allowedMimeTypes.includes(file.type)) {
        console.error('Invalid file type:', file.type);
        throw new Error(`Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`);
      }
    }

    const uploadOptions = {
      folder: options.folder || storageConfig.products.path,
      public_id: options.public_id || `${Date.now()}-${path}`,
      resource_type: resourceType,
      overwrite: options.overwrite ?? true,
      allowed_formats: allowedFormats, // Cloudinary يحتاج الامتدادات وليس MIME types
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
        if (error) {
          console.error('Cloudinary upload error:', {
            message: error.message,
            name: error.name,
            http_code: error.http_code,
          });
          reject(new Error(`Cloudinary upload failed: ${error.message}`));
        } else {
          console.log('Cloudinary upload success:', {
            secure_url: result?.secure_url,
            public_id: result?.public_id,
          });
          resolve(result);
        }
      });
      uploadStream.end(buffer);
    });

    const { secure_url: secureUrl, public_id: publicId } = uploadResult as {
      secure_url: string;
      public_id: string;
    };

    if (!secureUrl || !publicId) {
      throw new Error('Invalid upload response from Cloudinary');
    }

    console.log(`Uploaded file to Cloudinary: ${secureUrl}`);
    return { secureUrl, publicId };
  } catch (error) {
    console.error('Upload error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw new Error(error instanceof Error ? error.message : 'Failed to upload file');
  }
}

export async function deleteFromStorage(publicId: string): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId, { invalidate: true });
    console.log(`Deleted file from Cloudinary: ${publicId}`);
  } catch (error) {
    console.error('Delete error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
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
