import { z } from 'zod';
import { formatNumberWithDecimal } from './utils';

// ============================================
// Common Validators
// ============================================
const MongoId = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, { message: 'Invalid MongoDB ID' });

const Price = (field: string) =>
  z.coerce
    .number()
    .refine(
      (value) => /^\d+(\.\d{2})?$/.test(formatNumberWithDecimal(value)),
      `${field} must have exactly two decimal places (e.g., 49.99)`
    );

// ============================================
// User Related Schemas
// ============================================
const UserName = z
  .string()
  .min(2, { message: 'Username must be at least 2 characters' })
  .max(50, { message: 'Username must be at most 50 characters' });

const Email = z.string().min(1, 'Email is required').email('Email is invalid');
const Password = z.string().min(3, 'Password must be at least 3 characters');
const UserRole = z.enum(['user', 'Admin', 'SELLER']).refine(
  (value) => ['user', 'Admin', 'SELLER'].includes(value),
  {
    message: 'Role must be one of: user, Admin, SELLER',
  }
);

export const UserInputSchema = z.object({
  name: UserName,
  email: Email,
  image: z.string().optional(),
  emailVerified: z.boolean(),
  role: UserRole,
  password: Password,
  paymentMethod: z.string().min(1, 'Payment method is required'),
  address: z.object({
    fullName: z.string().min(1, 'Full name is required'),
    street: z.string().min(1, 'Street is required'),
    city: z.string().min(1, 'City is required'),
    province: z.string().min(1, 'Province is required'),
    postalCode: z.string().min(1, 'Postal code is required'),
    country: z.string().min(1, 'Country is required'),
    phone: z.string().min(1, 'Phone number is required'),
  }),
});



export const NewsArticleInputSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(255, 'Title must not exceed 255 characters'),
  slug: z.string().min(3, 'Slug must be at least 3 characters').max(255, 'Slug must not exceed 255 characters').regex(/^[a-z0-9-]+$/,'Slug must contain only lowercase letters, numbers, and hyphens'),
  excerpt: z.string().min(10, 'Excerpt must be at least 10 characters').max(160, 'Excerpt must not exceed 160 characters'),
  content: z.string().min(100, 'Content must be at least 100 characters'),
  tags: z.array(z.string()).min(1, 'At least one tag is required'),
  metaTitle: z.string().min(5, 'Meta title must be at least 5 characters').max(60, 'Meta title must not exceed 60 characters'),
  metaDescription: z.string().min(10, 'Meta description must be at least 10 characters').max(160, 'Meta description must not exceed 160 characters'),
  image: z.string().url('Invalid image URL').optional().default('https://mark-elasfar.web.app/assets/img/default-article.jpg'),
  isPublished: z.boolean(),
  isFeatured: z.boolean(),
  authorId: z.string().min(1, 'Author ID is required'),
  likes: z.number().optional().default(0),
  views: z.number().optional().default(0),
})

export const NewsArticleUpdateSchema = NewsArticleInputSchema.extend({
  _id: z.string().min(1, 'Article ID is required'),
})

export const UserUpdateSchema = z.object({
  _id: MongoId,
  name: UserName,
  email: Email,
  role: UserRole,
});

export const UserSignInSchema = z.object({
  email: Email,
  password: Password,
});

export const UserSignUpSchema = UserSignInSchema.extend({
  name: UserName,
  phone: z.string().min(1, 'Phone number is required').regex(/^\+?\d{10,15}$/, 'Phone number must be valid'),
  confirmPassword: Password,
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export const UserNameSchema = z.object({
  name: UserName,
});

// ============================================
// Product Related Schemas
// ============================================
export const ReviewInputSchema = z.object({
  product: MongoId,
  user: MongoId,
  isVerifiedPurchase: z.boolean(),
  title: z.string().min(1, 'Title is required'),
  comment: z.string().min(1, 'Comment is required'),
  rating: z.coerce
    .number()
    .int()
    .min(1, 'Rating must be at least 1')
    .max(5, 'Rating must be at most 5'),
});

export const ProductInputSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  slug: z.string().min(3, 'Slug must be at least 3 characters'),
  category: z.string().min(1, 'Category is required'),
  images: z.array(z.string()).min(1, 'Product must have at least one image'),
  brand: z.string().min(1, 'Brand is required'),
  description: z.string().min(1, 'Description is required'),
  isPublished: z.boolean(),
  price: Price('Price'),
  listPrice: Price('List price'),
  countInStock: z.coerce
    .number()
    .int()
    .nonnegative('count in stock must be a non-negative number'),
  tags: z.array(z.string()).default([]),
  sizes: z.array(z.string()).default([]),
  avgRating: z.coerce
    .number()
    .min(0, 'Average rating must be at least 0')
    .max(5, 'Average rating must be at most 5'),
  numReviews: z.coerce
    .number()
    .int()
    .nonnegative('Number of reviews must be a non-negative number'),
  ratingDistribution: z
    .array(z.object({ rating: z.number(), count: z.number() }))
    .max(5),
  reviews: z.array(ReviewInputSchema).default([]),
  numSales: z.coerce
    .number()
    .int()
    .nonnegative('Number of sales must be a non-negative number'),
});

export const ProductUpdateSchema = ProductInputSchema.extend({
  _id: z.string(),
});

// ============================================
// Order Related Schemas
// ============================================
export const OrderItemSchema = z.object({
  clientId: z.string().min(1, 'clientId is required'),
  product: z.string().min(1, 'Product is required'),
  name: z.string().min(1, 'Name is required'),
  slug: z.string().min(1, 'Slug is required'),
  category: z.string().min(1, 'Category is required'),
  quantity: z
    .number()
    .int()
    .nonnegative('Quantity must be a non-negative number'),
  countInStock: z
    .number()
    .int()
    .nonnegative('Quantity must be a non-negative number'),
  image: z.string().min(1, 'Image is required'),
  price: Price('Price'),
  size: z.string().optional(),
  color: z.union([
    z.string(),
    z.object({
      name: z.string().min(1, 'Color name is required'),
    }),
  ]).optional(),
  pointsUsed: z.number().default(0).optional(),
  pointsDiscount: z.number().default(0).optional(),
});

export const ShippingAddressSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  street: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  postalCode: z.string().min(1, 'Postal code is required'),
  province: z.string().min(1, 'Province is required'),
  phone: z.string().min(1, 'Phone number is required'),
  country: z.string().min(1, 'Country is required'),
});

export const OrderInputSchema = z.object({
  user: z.union([
    MongoId,
    z.object({
      name: z.string(),
      email: z.string().email(),
    }),
  ]),
  items: z
    .array(OrderItemSchema)
    .min(1, 'Order must contain at least one item'),
  shippingAddress: ShippingAddressSchema,
  paymentMethod: z.string().min(1, 'Payment method is required'),
  paymentResult: z
    .object({
      id: z.string(),
      status: z.string(),
      email_address: z.string(),
      pricePaid: z.string(),
    })
    .optional(),
  itemsPrice: Price('Items price'),
  shippingPrice: Price('Shipping price'),
  taxPrice: Price('Tax price'),
  totalPrice: Price('Total price'),
  expectedDeliveryDate: z
    .date()
    .refine(
      (value) => value > new Date(),
      'Expected delivery date must be in the future'
    ),
  isDelivered: z.boolean().default(false),
  deliveredAt: z.date().optional(),
  createdAt: z.date().optional(),
  isPaid: z.boolean().default(false),
  paidAt: z.date().optional(),
});

export const subscriptionUpdateSchema = z.object({
  // plan: z.string().min(1, 'Plan is required'),
  // pointsToRedeem: z.number().min(0, 'Points to redeem must be non-negative'),
  // paymentMethod: z.string().optional(),
  // currency: z.string().optional(),
  // market: z.string().optional(),
  // paymentGatewayId: z.string().optional(),
  plan: z.string().min(1, 'planRequired'),
  pointsToRedeem: z.number().min(0).optional(),
  paymentMethod: z.string().optional(),
  currency: z.string().optional(),
  market: z.string().optional(),
  trialMonthsUsed: z.number().optional(),
});

// ============================================
// Cart Schema
// ============================================
export const CartSchema = z.object({
  items: z
    .array(OrderItemSchema)
    .min(1, 'Order must contain at least one item'),
  itemsPrice: z.number(),
  taxPrice: z.optional(z.number()),
  shippingPrice: z.optional(z.number()),
  totalPrice: z.number(),
  paymentMethod: z.optional(z.string()),
  shippingAddress: z.optional(ShippingAddressSchema),
  deliveryDateIndex: z.optional(z.number()),
  expectedDeliveryDate: z.optional(z.date()),
});

// ============================================
// Website Related Schemas
// ============================================
export const WebPageInputSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  slug: z.string().min(3, 'Slug must be at least 3 characters'),
  content: z.string().min(1, 'Content is required'),
  isPublished: z.boolean(),
});

export const WebPageUpdateSchema = WebPageInputSchema.extend({
  _id: z.string(),
});

// ============================================
// Settings Related Schemas
// ============================================
export const SiteLanguageSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Code is required'),
});

export const CarouselSchema = z.object({
  title: z.string().min(1, 'title is required'),
  url: z.string().min(1, 'url is required'),
  image: z.string().min(1, 'image is required'),
  buttonCaption: z.string().min(1, 'buttonCaption is required'),
  isPublished: z.boolean(),
});

export const SiteCurrencySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Code is required'),
  convertRate: z.coerce.number().min(0, 'Convert rate must be at least 0'),
  symbol: z.string().min(1, 'Symbol is required'),
});

export const PaymentMethodSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  commission: z.coerce.number().min(0, 'Commission must be at least 0'),
});

export const DeliveryDateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  daysToDeliver: z.number().min(0, 'Days to deliver must be at least 0'),
  shippingPrice: z.coerce.number().min(0, 'Shipping price must be at least 0'),
  validator: z
    .string()
    .optional()
    .refine(
      (val) => !val || /^(\d{4}-\d{2}-\d{2})$/.test(val),
      'Validator must be a valid date format (YYYY-MM-DD)'
    ),
  freeShippingMinPrice: z.coerce
    .number()
    .min(0, 'Free shipping min amount must be at least 0'),
});

export const SettingInputSchema = z.object({
  common: z.object({
    pageSize: z.coerce
      .number()
      .min(1, 'Page size must be at least 1')
      .default(9),
    isMaintenanceMode: z.boolean().default(false),
    freeShippingMinPrice: z.coerce
      .number()
      .min(0, 'Free shipping min price must be at least 0')
      .default(0),
    defaultTheme: z
      .string()
      .min(1, 'Default theme is required')
      .default('light'),
    defaultColor: z
      .string()
      .min(1, 'Default color is required')
      .default('gold'),
  }),
  site: z.object({
    name: z.string().min(1, 'Name is required'),
    logo: z.string().min(1, 'logo is required'),
    slogan: z.string().min(1, 'Slogan is required'),
    description: z.string().min(1, 'Description is required'),
    keywords: z.string().min(1, 'Keywords is required'),
    url: z.string().min(1, 'Url is required'),
    email: z.string().min(1, 'Email is required'),
    phone: z.string().min(1, 'Phone is required'),
    author: z.string().min(1, 'Author is required'),
    copyright: z.string().min(1, 'Copyright is required'),
    address: z.string().min(1, 'Address is required'),
  }),
  availableLanguages: z
    .array(SiteLanguageSchema)
    .min(1, 'At least one language is required'),
  carousels: z
    .array(CarouselSchema)
    .min(1, 'At least one carousel is required'),
  defaultLanguage: z.string().min(1, 'Language is required'),
  availableCurrencies: z
    .array(SiteCurrencySchema)
    .min(1, 'At least one currency is required'),
  defaultCurrency: z.string().min(1, 'Currency is required'),
  availablePaymentMethods: z
    .array(PaymentMethodSchema)
    .min(1, 'At least one payment method is required'),
  defaultPaymentMethod: z.string().min(1, 'Payment method is required'),
  availableDeliveryDates: z
    .array(DeliveryDateSchema)
    .min(1, 'At least one delivery date is required'),
  defaultDeliveryDate: z.string().min(1, 'Delivery date is required'),
  integrations: z
    .array(
      z.object({
        provider: z.string().min(1, 'Provider is required'),
        apiKey: z.string().optional(),
        secretKey: z.string().optional(),
        token: z.string().optional(),
        refreshToken: z.string().optional(),
        expiresAt: z.date().optional(),
        metadata: z.record(z.string(), z.any()).optional(),
      })
    )
    .optional(),
  aiAssistant: z.object({
    price: z.number().min(0),
    description: z.string().min(1),
    image: z.string().url(),
    enabled: z.boolean(),
    freeLimit: z.number().min(0),
  }),
  points: z
    .object({
      earnRate: z.number().min(0, 'Earn rate must be non-negative'),
      redeemValue: z.number().min(0, 'Redeem value must be non-negative'),
      registrationBonus: z.object({
        buyer: z.number().min(0, 'Buyer bonus must be non-negative'),
        seller: z.number().min(0, 'Seller bonus must be non-negative'),
      }),
      sellerPointsPerSale: z.number().min(0, 'Seller points per sale must be non-negative'),
    })
    .optional(),
});