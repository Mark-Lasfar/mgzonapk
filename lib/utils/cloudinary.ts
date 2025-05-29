
import { v2 as cloudinary } from 'cloudinary'
import type { UploadApiResponse } from 'cloudinary'

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
})

export interface StorageOptions {
  folder?: string
  public_id?: string
  resource_type?: 'auto' | 'image' | 'video' | 'raw'
  overwrite?: boolean
  maxSize?: number
  allowedFormats?: string[]
}

export async function uploadToCloudinary(
  file: File | Buffer,
  options: StorageOptions = {}
): Promise<UploadApiResponse> {
  const buffer = file instanceof File ? await file.arrayBuffer() : file

  if (options.maxSize && buffer.byteLength > options.maxSize) {
    throw new Error(`File exceeds size limit of ${options.maxSize / 1024 / 1024}MB`)
  }

  return await new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        folder: options.folder ?? 'uploads',
        public_id: options.public_id ?? `${Date.now()}`,
        resource_type: options.resource_type ?? 'auto',
        overwrite: options.overwrite ?? true,
        allowed_formats: options.allowedFormats,
      },
      (err, result) => (err ? reject(err) : resolve(result!))
    ).end(Buffer.from(buffer))
  })
}

export async function deleteFromCloudinary(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId)
}

export function getPublicIdFromUrl(url: string): string {
  const parts = url.split('/')
  const filename = parts[parts.length - 1]
  return filename.split('.')[0]
}
