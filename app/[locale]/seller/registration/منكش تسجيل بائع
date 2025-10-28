import { connectToDatabase } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import Seller from '@/lib/db/models/seller.model'
import User from '@/lib/db/models/user.model'
import mongoose from 'mongoose'
import { z } from 'zod'
import { uploadToStorage } from '@/lib/utils/s3'

// Validation schema for seller registration data
const sellerRegistrationSchema = z.object({
  businessName: z.string()
    .min(2, 'Business name must be at least 2 characters')
    .max(100, 'Business name must not exceed 100 characters'),
  email: z.string()
    .email('Invalid email address'),
  phone: z.string()
    .min(10, 'Phone number must be at least 10 characters')
    .max(20, 'Phone number must not exceed 20 characters')
    .regex(/^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/, 'Invalid phone number format'),
  description: z.string()
    .min(50, 'Description must be at least 50 characters')
    .max(500, 'Description must not exceed 500 characters'),
  businessType: z.enum(['individual', 'company']),
  vatRegistered: z.boolean().optional().default(false),
  logo: z.string().optional(),
  address: z.object({
    street: z.string().min(1, 'Street is required'),
    city: z.string().min(1, 'City is required'),
    state: z.string().min(1, 'State is required'),
    country: z.string().min(1, 'Country is required'),
    postalCode: z.string().min(1, 'Postal code is required'),
  }),
  taxId: z.string().min(1, 'Tax ID is required'),
  bankInfo: z.object({
    accountName: z.string().min(2, 'Account name is required'),
    accountNumber: z.string().min(8, 'Account number is required'),
    bankName: z.string().min(2, 'Bank name is required'),
    swiftCode: z.string().regex(/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/, 'Invalid SWIFT code format'),
  }),
  termsAccepted: z.boolean().refine((val) => val === true, 'Terms must be accepted'),
})

type SellerRegistrationData = z.infer<typeof sellerRegistrationSchema>

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const userSession = await auth()
    if (!userSession?.user?.id) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse and validate the multipart form data
    const formData = await request.formData()
    let data: SellerRegistrationData

    try {
      const jsonData = formData.get('data')
      if (!jsonData || typeof jsonData !== 'string') {
        throw new Error('Invalid form data')
      }

      const parsedData = JSON.parse(jsonData)

      // لو فيه ملف مرفوع، ارفعه هنا وأضف الـ URL قبل Zod check
      const logoFile = formData.get('logo') as File | null
      let logoUrl = ''
      
      if (logoFile) {
        // التحقق من الحجم والصيغة، ثم الرفع كالمعتاد
        const maxSize = 5 * 1024 * 1024 // 5MB
        if (logoFile.size > maxSize) {
          return NextResponse.json({ success: false, message: 'Logo file size must not exceed 5MB' }, { status: 400 })
        }
      
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
        if (!allowedTypes.includes(logoFile.type)) {
          return NextResponse.json({ success: false, message: 'Invalid file type. Only JPEG, PNG, and WebP images are allowed' }, { status: 400 })
        }
      
        const arrayBuffer = await logoFile.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
      
        logoUrl = await uploadToStorage(buffer, `sellers/${userSession.user.id}/logo`, {
          folder: 'sellers',
          resource_type: 'image',
          allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
          public_id: `${userSession.user.id}-${Date.now()}`,
          overwrite: true
        })
      
        // أضف الرابط في البيانات قبل Zod parsing
        parsedData.logo = logoUrl
      }
      
      // بعد كل ده، تحقق بالـ schema
      data = sellerRegistrationSchema.parse(parsedData)
      
    } catch (error) {
      console.error('Data parsing error:', error)
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            success: false,
            message: 'Invalid data',
            errors: error.errors.map(err => ({
              path: err.path.join('.'),
              message: err.message
            }))
          },
          { status: 400 }
        )
      }
      return NextResponse.json(
        {
          success: false,
          message: 'Failed to parse registration data'
        },
        { status: 400 }
      )
    }

    // Handle logo upload if present (in case it hasn't been processed above)
    const logoFile = formData.get('logo') as File | null
    let logoUrl = ''
    if (logoFile) {
      try {
        const maxSize = 5 * 1024 * 1024 // 5MB
        if (logoFile.size > maxSize) {
          return NextResponse.json(
            {
              success: false,
              message: 'Logo file size must not exceed 5MB'
            },
            { status: 400 }
          )
        }

        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
        if (!allowedTypes.includes(logoFile.type)) {
          return NextResponse.json(
            {
              success: false,
              message: 'Invalid file type. Only JPEG, PNG, and WebP images are allowed'
            },
            { status: 400 }
          )
        }

        const arrayBuffer = await logoFile.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        logoUrl = await uploadToStorage(buffer, `sellers/${userSession.user.id}/logo`, {
          folder: 'sellers',
          resource_type: 'image',
          allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
          public_id: `${userSession.user.id}-${Date.now()}`,
          overwrite: true
        })

        data.logo = logoUrl
      } catch (error) {
        console.error('Logo upload error:', error)
        return NextResponse.json(
          {
            success: false,
            message: 'Failed to upload logo'
          },
          { status: 500 }
        )
      }
    }

    // Connect to database
    await connectToDatabase()

    // Start transaction
    const dbSession = await mongoose.startSession()
    dbSession.startTransaction()

    try {
      // Check for existing seller
      const existingSeller = await Seller.findOne({
        $or: [
          { email: data.email },
          { userId: userSession.user.id }
        ]
      }).session(dbSession)

      if (existingSeller) {
        throw new Error('A seller profile already exists for this account')
      }

      // Create seller profile
      const seller = await Seller.create([{
        userId: userSession.user.id,
        businessName: data.businessName,
        email: data.email,
        phone: data.phone,
        description: data.description,
        businessType: data.businessType,
        logo: data.logo || '',
        address: {
          street: data.address.street,
          city: data.address.city,
          state: data.address.state,
          country: data.address.country,
          postalCode: data.address.postalCode,
        },
        taxId: data.taxId,
        bankInfo: {
          accountName: data.bankInfo.accountName,
          accountNumber: data.bankInfo.accountNumber,
          bankName: data.bankInfo.bankName,
          swiftCode: data.bankInfo.swiftCode,
          verified: false
        },
        subscription: {
          plan: 'Basic',
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days trial
          status: 'active',
          features: {
            productsLimit: 100,
            commission: 5, // 5%
            prioritySupport: false,
            instantPayouts: false
          }
        },
        verification: {
          status: 'pending',
          documents: {},
          submittedAt: new Date(),
          verifiedAt: null
        },
        metrics: {
          rating: 0,
          totalSales: 0,
          totalRevenue: 0,
          productsCount: 0,
          ordersCount: 0,
          customersCount: 0,
          views: 0,
          followers: 0
        },
        settings: {
          notifications: {
            email: true,
            sms: false,
            orderUpdates: true,
            marketingEmails: false
          },
          display: {
            showRating: true,
            showContactInfo: true,
            showMetrics: true
          },
          security: {
            twoFactorAuth: false,
            loginNotifications: true
          }
        },
        vatRegistered: data.vatRegistered,
        createdAt: new Date(),
        updatedAt: new Date(),
      }], { session: dbSession })

      // Update user role
      const updatedUser = await User.findByIdAndUpdate(
        userSession.user.id,
        {
          role: 'SELLER',
          businessProfile: seller[0]._id
        },
        { new: true, session: dbSession }
      )

      if (!updatedUser) {
        throw new Error('Failed to update user role')
      }

      // Commit transaction
      await dbSession.commitTransaction()

      return NextResponse.json({
        success: true,
        message: 'Successfully registered as seller',
        data: {
          id: seller[0]._id,
          businessName: seller[0].businessName,
          email: seller[0].email,
          role: updatedUser.role,
          subscription: seller[0].subscription,
        }
      })

    } catch (error) {
      await dbSession.abortTransaction()
      throw error
    } finally {
      await dbSession.endSession()
    }

  } catch (error) {
    console.error('Seller registration error:', error)

    if (error instanceof mongoose.Error.ValidationError) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid seller data',
          errors: Object.values(error.errors).map(err => ({
            field: err.path,
            message: err.message
          }))
        },
        { status: 400 }
      )
    }

    if (error instanceof mongoose.mongo.MongoServerError && error.code === 11000) {
      return NextResponse.json(
        {
          success: false,
          message: 'A seller with this email already exists'
        },
        { status: 409 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Registration failed'
      },
      { status: 500 }
    )
  }
}

export const config = {
  api: {
    bodyParser: false, // Disable default body parser
    responseLimit: false,
  },
}