// Current Date and Time (UTC - YYYY-MM-DD HH:MM:SS formatted): 2025-04-28 22:56:00
// Current User's Login: Mark-Lasfar

import { v2 as cloudinary } from 'cloudinary'
import { UploadApiResponse } from 'cloudinary'
import { createUploadthing, type FileRouter } from 'uploadthing/next'

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

// Create UploadThing instance
const f = createUploadthing()

export interface StorageConfig {
  maxFileSize?: number
  allowedFileTypes?: string[]
  folder?: string
  maxFiles?: number
}

export const uploadRouter = {
  imageUploader: f({ image: { maxFileSize: '4MB', maxFileCount: 1 } })
    .middleware(async () => {
      return { uploadthingToken: process.env.UPLOADTHING_TOKEN }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return { uploadedBy: metadata.uploadthingToken, url: file.url }
    }),

  multiImageUploader: f({ image: { maxFileSize: '16MB', maxFileCount: 4 } })
    .middleware(async () => {
      return { uploadthingToken: process.env.UPLOADTHING_TOKEN }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return { uploadedBy: metadata.uploadthingToken, url: file.url }
    }),

  documentUploader: f({ pdf: { maxFileSize: '8MB', maxFileCount: 1 } })
    .middleware(async () => {
      return { uploadthingToken: process.env.UPLOADTHING_TOKEN }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return { uploadedBy: metadata.uploadthingToken, url: file.url }
    }),
} satisfies FileRouter

export type OurFileRouter = typeof uploadRouter

export async function uploadToCloudinary(
  file: File,
  config: StorageConfig = {}
): Promise<UploadApiResponse> {
  const {
    maxFileSize = 4 * 1024 * 1024, // 4MB default
    allowedFileTypes = ['image/jpeg', 'image/png', 'image/webp'],
    folder = 'uploads',
  } = config

  if (!file) {
    throw new Error('No file provided')
  }

  // Validate file size
  if (file.size > maxFileSize) {
    throw new Error(`File size exceeds ${maxFileSize / (1024 * 1024)}MB limit`)
  }

  // Validate file type
  if (!allowedFileTypes.includes(file.type)) {
    throw new Error(`File type ${file.type} is not allowed`)
  }

  // Convert file to base64
  const base64Data = await fileToBase64(file)

  try {
    return await cloudinary.uploader.upload(base64Data, {
      folder,
      resource_type: 'auto',
    })
  } catch (error) {
    console.error('Cloudinary upload error:', error)
    throw new Error('Failed to upload file')
  }
}

export async function deleteFromCloudinary(publicId: string): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId)
  } catch (error) {
    console.error('Cloudinary delete error:', error)
    throw new Error('Failed to delete file')
  }
}

// Helper functions
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = (error) => reject(error)
  })
}

export function getPublicIdFromUrl(url: string): string {
  const urlParts = url.split('/')
  const filename = urlParts[urlParts.length - 1]
  return filename.split('.')[0]
}