import { toSlug } from './utils'
import bcrypt from 'bcryptjs'
import { i18n } from '@/i18n-config'
import { Data, IProductInput, IReviewInput } from '@/types';

// Simplified distance calculation (Euclidean distance in km)
const calculateDistance = (
  warehouse: { lat: number; lon: number },
  customer: { lat: number; lon: number }
): number => {
  const R = 6371 // Earth's radius in km
  const dLat = ((customer.lat - warehouse.lat) * Math.PI) / 180
  const dLon = ((customer.lon - warehouse.lon) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((warehouse.lat * Math.PI) / 180) *
      Math.cos((customer.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// Shipping cost and delivery time calculation
const calculateShipping = (
  product: IProductInput,
  customerAddress: { country: string; city: string; lat: number; lon: number }
): { shippingPrice: number; daysToDeliver: number } => {
  const warehouse = product.warehouse
  const distance = calculateDistance(warehouse, customerAddress)

  // Base cost per km
  const baseCostPerKm = 0.02 // $0.02 per km
  let distanceCost = distance * baseCostPerKm

  // Weight and volume cost
  const weightCost = product.weight * 0.5 // $0.5 per kg
  const volumeCost = product.volume * 0.0001 // $0.0001 per cm³

  // Country-specific customs fees
  const customsFees: { [key: string]: number } = {
    USA: 0,
    EU: 5,
    UAE: 3,
    Other: 10,
  }
  const customsFee = customsFees[customerAddress.country] || customsFees.Other

  // Total shipping cost
  let shippingPrice = distanceCost + weightCost + volumeCost + customsFee

  // Delivery time (days)
  let daysToDeliver = 1 + Math.ceil(distance / 500) // Base 1 day + 1 day per 500 km
  if (customsFee > 0) daysToDeliver += 2 // Add 2 days for customs processing
  if (customerAddress.country !== 'USA') daysToDeliver += 1 // Add 1 day for international

  // Free shipping threshold
  const freeShippingMinPrice = 35
  if (product.price >= freeShippingMinPrice) {
    shippingPrice = 0
  }

  return {
    shippingPrice: Number(shippingPrice.toFixed(2)),
    daysToDeliver,
  }
}

const users: IUserInput[] = [
  {
    name: 'Mark',
    email: 'admin@mgzon.com',
    password: bcrypt.hashSync('elasfar691458', 5),
    role: 'Admin',
    address: {
      fullName: 'ibrahim elasfar',
      street: '123 Admin St',
      city: 'New York',
      province: 'NY',
      postalCode: '10000',
      country: 'USA',
      phone: '123-456-7890',
      lat: 40.7128,
      lon: -74.0060,
    },
    paymentMethod: 'Stripe',
    emailVerified: true,
  },
  {
    name: 'John Seller',
    email: 'john.seller@example.com',
    password: bcrypt.hashSync('123456', 5),
    role: 'SELLER',
    address: {
      fullName: 'John Doe',
      street: '111 Main St',
      city: 'New York',
      province: 'NY',
      postalCode: '10001',
      country: 'USA',
      phone: '123-456-7890',
      lat: 40.7128,
      lon: -74.0060,
    },
    paymentMethod: 'PayPal',
    emailVerified: false,
  },
  {
    name: 'Jane',
    email: 'jane@example.com',
    password: bcrypt.hashSync('123456', 5),
    role: 'user',
    address: {
      fullName: 'Jane Harris',
      street: '222 Main St',
      city: 'New York',
      province: 'NY',
      postalCode: '10002',
      country: 'USA',
      phone: '123-456-7890',
      lat: 40.7128,
      lon: -74.0060,
    },
    paymentMethod: 'Cash On Delivery',
    emailVerified: false,
  },
  {
    name: 'Jack Seller',
    email: 'jack.seller@example.com',
    password: bcrypt.hashSync('123456', 5),
    role: 'SELLER',
    address: {
      fullName: 'Jack Ryan',
      street: '333 Main St',
      city: 'Los Angeles',
      province: 'CA',
      postalCode: '90001',
      country: 'USA',
      phone: '123-456-7890',
      lat: 34.0522,
      lon: -118.2437,
    },
    paymentMethod: 'Stripe',
    emailVerified: false,
  },
  {
    name: 'Sarah',
    email: 'sarah@example.com',
    password: bcrypt.hashSync('123456', 5),
    role: 'user',
    address: {
      fullName: 'Sarah Smith',
      street: '444 Main St',
      city: 'New York',
      province: 'NY',
      postalCode: '10005',
      country: 'USA',
      phone: '123-456-7890',
      lat: 40.7128,
      lon: -74.0060,
    },
    paymentMethod: 'Cash On Delivery',
    emailVerified: false,
  },
  {
    name: 'Michael',
    email: 'michael@example.com',
    password: bcrypt.hashSync('123456', 5),
    role: 'user',
    address: {
      fullName: 'Michael Alexander',
      street: '555 Main St',
      city: 'New York',
      province: 'NY',
      postalCode: '10006',
      country: 'USA',
      phone: '123-456-7890',
      lat: 40.7128,
      lon: -74.0060,
    },
    paymentMethod: 'PayPal',
    emailVerified: false,
  },
  {
    name: 'Emily',
    email: 'emily@example.com',
    password: bcrypt.hashSync('123456', 5),
    role: 'user',
    address: {
      fullName: 'Emily Johnson',
      street: '666 Main St',
      city: 'New York',
      province: 'NY',
      postalCode: '10001',
      country: 'USA',
      phone: '123-456-7890',
      lat: 40.7128,
      lon: -74.0060,
    },
    paymentMethod: 'Stripe',
    emailVerified: false,
  },
  {
    name: 'Alice',
    email: 'alice@example.com',
    password: bcrypt.hashSync('123456', 5),
    role: 'user',
    address: {
      fullName: 'Alice Cooper',
      street: '777 Main St',
      city: 'New York',
      province: 'NY',
      postalCode: '10007',
      country: 'USA',
      phone: '123-456-7890',
      lat: 40.7128,
      lon: -74.0060,
    },
    paymentMethod: 'Cash On Delivery',
    emailVerified: false,
  },
  {
    name: 'Tom',
    email: 'tom@example.com',
    password: bcrypt.hashSync('123456', 5),
    role: 'user',
    address: {
      fullName: 'Tom Hanks',
      street: '888 Main St',
      city: 'New York',
      province: 'NY',
      postalCode: '10008',
      country: 'USA',
      phone: '123-456-7890',
      lat: 40.7128,
      lon: -74.0060,
    },
    paymentMethod: 'Stripe',
    emailVerified: false,
  },
  {
    name: 'Linda',
    email: 'linda@example.com',
    password: bcrypt.hashSync('123456', 5),
    role: 'user',
    address: {
      fullName: 'Linda Holmes',
      street: '999 Main St',
      city: 'New York',
      province: 'NY',
      postalCode: '10009',
      country: 'USA',
      phone: '123-456-7890',
      lat: 40.7128,
      lon: -74.0060,
    },
    paymentMethod: 'PayPal',
    emailVerified: false,
  },
  {
    name: 'George',
    email: 'george@example.com',
    password: bcrypt.hashSync('123456', 5),
    role: 'user',
    address: {
      fullName: 'George Smith',
      street: '101 First Ave',
      city: 'New York',
      province: 'NY',
      postalCode: '10010',
      country: 'USA',
      phone: '123-456-7890',
      lat: 40.7128,
      lon: -74.0060,
    },
    paymentMethod: 'Stripe',
    emailVerified: false,
  },
  {
    name: 'Jessica',
    email: 'jessica@example.com',
    password: bcrypt.hashSync('123456', 5),
    role: 'user',
    address: {
      fullName: 'Jessica Brown',
      street: '102 First Ave',
      city: 'New York',
      province: 'NY',
      postalCode: '10011',
      country: 'USA',
      phone: '123-456-7890',
      lat: 40.7128,
      lon: -74.0060,
    },
    paymentMethod: 'Cash On Delivery',
    emailVerified: false,
  },
  {
    name: 'Chris',
    email: 'chris@example.com',
    password: bcrypt.hashSync('123456', 5),
    role: 'user',
    address: {
      fullName: 'Chris Evans',
      street: '103 First Ave',
      city: 'New York',
      province: 'NY',
      postalCode: '10012',
      country: 'USA',
      phone: '123-456-7890',
      lat: 40.7128,
      lon: -74.0060,
    },
    paymentMethod: 'PayPal',
    emailVerified: false,
  },
]

const products: IProductInput[] = [
  {
    name: 'Sample Product',
    slug: toSlug('Sample Product'),
    category: 'Sample Category',
    images: ['/images/sample.jpg'],
    brand: 'Sample Brand',
    description: 'Sample description',
    price: 99.99,
    listPrice: 129.99,
    countInStock: 100,
    sellerId: 'john.seller@example.com',
    sellerName: 'John Seller',
    warehouse: {
      provider: 'ShipBob',
      sku: 'SAMPLE-001',
      location: 'New York',
      lat: 40.7128,
      lon: -74.0060,
      availableQuantity: 100,
    },
    weight: 0.5, // kg
    volume: 1000, // cm³
    isPublished: true,
    tags: ['sample'],
    sizes: ['S', 'M', 'L'],
    colors: [{ name: 'Black' }, { name: 'White' }], // Updated to array of objects
    numReviews: 0,
    numSales: 0,
    avgRating: 0,
    ratingDistribution: [
      { rating: 1, count: 0 },
      { rating: 2, count: 0 },
      { rating: 3, count: 0 },
      { rating: 4, count: 0 },
      { rating: 5, count: 0 },
    ],
    reviews: [],
  },
  {
    name: 'Nike Mens Slim-fit Long-Sleeve T-Shirt',
    slug: toSlug('Nike Mens Slim-fit Long-Sleeve T-Shirt'),
    category: 'T-Shirts',
    images: ['/images/p11-1.jpg', '/images/p11-2.jpg'],
    tags: ['new-arrival'],
    isPublished: true,
    price: 21.8,
    listPrice: 0,
    brand: 'Nike',
    avgRating: 4.71,
    numReviews: 7,
    ratingDistribution: [
      { rating: 1, count: 0 },
      { rating: 2, count: 0 },
      { rating: 3, count: 0 },
      { rating: 4, count: 2 },
      { rating: 5, count: 5 },
    ],
    numSales: 9,
    countInStock: 11,
    description: 'Made with chemicals safer for human health and the environment',
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    colors: [{ name: 'Black' }, { name: 'White' }], // Updated to array of objects
    sellerId: 'john.seller@example.com',
    sellerName: 'John Seller',
    warehouse: {
      provider: 'ShipBob',
      sku: 'NIKE-TS-001',
      location: 'New York',
      lat: 40.7128,
      lon: -74.0060,
      availableQuantity: 11,
    },
    weight: 0.3,
    volume: 500,
    reviews: [],
  },
  {
    name: 'Jerzees Long-Sleeve Heavyweight Blend T-Shirt',
    slug: toSlug('Jerzees Long-Sleeve Heavyweight Blend T-Shirt'),
    category: 'T-Shirts',
    images: [
      '/images/p12-1.jpg',
      '/images/p12-2.jpg',
      '/images/p12-3.jpg',
      '/images/p12-4.jpg',
    ],
    tags: ['featured'],
    isPublished: true,
    price: 23.78,
    listPrice: 0,
    brand: 'Jerzees',
    avgRating: 4.2,
    numReviews: 10,
    ratingDistribution: [
      { rating: 1, count: 1 },
      { rating: 2, count: 0 },
      { rating: 3, count: 0 },
      { rating: 4, count: 4 },
      { rating: 5, count: 5 },
    ],
    numSales: 29,
    countInStock: 12,
    description:
      'Made with sustainably sourced USA grown cotton; Shoulder-to-shoulder tape; double-needle coverstitched front neck; Set-in sleeves; Rib cuffs with concealed seams; Seamless body for a wide printing area',
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    colors: [{ name: 'Black' }, { name: 'White' }], // Updated to array of objects
    sellerId: 'jack.seller@example.com',
    sellerName: 'Jack Seller',
    warehouse: {
      provider: 'ShipBob',
      sku: 'JERZ-TS-002',
      location: 'Los Angeles',
      lat: 34.0522,
      lon: -118.2437,
      availableQuantity: 12,
    },
    weight: 0.4,
    volume: 600,
    reviews: [],
  },
  {
    name: "Jerzees Men's Long-Sleeve T-Shirt",
    slug: toSlug('Jerzees Men Long-Sleeve T-Shirt'),
    category: 'T-Shirts',
    brand: 'Jerzees',
    images: ['/images/p13-1.jpg', '/images/p13-2.jpg'],
    tags: ['best-seller'],
    isPublished: true,
    price: 13.86,
    listPrice: 16.03,
    avgRating: 4,
    numReviews: 12,
    ratingDistribution: [
      { rating: 1, count: 1 },
      { rating: 2, count: 0 },
      { rating: 3, count: 2 },
      { rating: 4, count: 4 },
      { rating: 5, count: 5 },
    ],
    numSales: 55,
    countInStock: 13,
    description:
      'The Jerzees long sleeve t-shirt is made with dri-power technology that wicks away moisture to keep you cool and dry throughout your day. We also included a rib collar and cuffs for added durability, and a lay-flat collar for comfort. If you are looking for a versatile shirt that you can wear throughout the transitioning seasons, then look no further.',
    sizes: ['XL', 'XXL'],
    colors: [{ name: 'Black' }, { name: 'White' }], // Updated to array of objects
    sellerId: 'john.seller@example.com',
    sellerName: 'John Seller',
    warehouse: {
      provider: 'ShipBob',
      sku: 'JERZ-TS-003',
      location: 'New York',
      lat: 40.7128,
      lon: -74.0060,
      availableQuantity: 13,
    },
    weight: 0.3,
    volume: 500,
    reviews: [],
  },
  {
    name: 'Decrum Mens Plain Long Sleeve T-Shirt - Comfortable Soft Fashion V Neck Full Sleeves Jersey Shirts',
    slug: toSlug(
      'Decrum Mens Plain Long Sleeve T-Shirt - Comfortable Soft Fashion V Neck Full Sleeves Jersey Shirts'
    ),
    category: 'T-Shirts',
    brand: 'Decrum',
    images: ['/images/p14-1.jpg', '/images/p14-2.jpg'],
    tags: ['todays-deal'],
    isPublished: true,
    price: 26.95,
    listPrice: 46.03,
    avgRating: 3.85,
    numReviews: 14,
    ratingDistribution: [
      { rating: 1, count: 0 },
      { rating: 2, count: 2 },
      { rating: 3, count: 3 },
      { rating: 4, count: 4 },
      { rating: 5, count: 5 },
    ],
    numSales: 54,
    countInStock: 14,
    description:
      'Elevate your outfit with this soft long sleeve t shirt men. This full sleeves tee is the ultimate upgrade from your regular cotton t-shirt.',
    sizes: ['XL', 'XXL'],
    colors: [{ name: 'Black' }, { name: 'White' }], // Updated to array of objects
    sellerId: 'jack.seller@example.com',
    sellerName: 'Jack Seller',
    warehouse: {
      provider: 'ShipBob',
      sku: 'DECR-TS-004',
      location: 'Los Angeles',
      lat: 34.0522,
      lon: -118.2437,
      availableQuantity: 14,
    },
    weight: 0.3,
    volume: 500,
    reviews: [],
  },
  {
    name: "Muscle Cmdr Men's Slim Fit Henley Shirt Long&Short Business Sleeve Casual 3 Metal Buton Placket Casual Stylish T-Shirt",
    slug: toSlug(
      "Muscle Cmdr Men's Slim Fit Henley Shirt Long&Short Business Sleeve Casual 3 Metal Buton Placket Casual Stylish T-Shirt"
    ),
    category: 'T-Shirts',
    brand: 'Muscle Cmdr',
    images: ['/images/p15-1.jpg', '/images/p15-2.jpg'],
    tags: ['new-arrival', 'featured'],
    isPublished: true,
    price: 29.99,
    listPrice: 35.99,
    avgRating: 3.66,
    numReviews: 15,
    ratingDistribution: [
      { rating: 1, count: 1 },
      { rating: 2, count: 2 },
      { rating: 3, count: 3 },
      { rating: 4, count: 4 },
      { rating: 5, count: 5 },
    ],
    numSales: 54,
    countInStock: 15,
    description:
      "Slim Fit Design: Men's Muscle Slim Fit Button Henley Shirts are designed to fit snugly against your body, accentuating your muscles and creating a sleek silhouette that's perfect for any occasion.",
    sizes: ['XL', 'XXL'],
    colors: [{ name: 'Black' }, { name: 'White' }], // Updated to array of objects
    sellerId: 'john.seller@example.com',
    sellerName: 'John Seller',
    warehouse: {
      provider: 'ShipBob',
      sku: 'MCMD-TS-005',
      location: 'New York',
      lat: 40.7128,
      lon: -74.0060,
      availableQuantity: 15,
    },
    weight: 0.4,
    volume: 600,
    reviews: [],
  },
  {
    name: 'Hanes Mens Long Sleeve Beefy Henley Shirt',
    slug: toSlug('Hanes Mens Long Sleeve Beefy Henley Shirt'),
    category: 'T-Shirts',
    brand: 'Hanes',
    images: ['/images/p16-1.jpg', '/images/p16-2.jpg'],
    tags: ['best-seller', 'todays-deal'],
    isPublished: true,
    price: 25.3,
    listPrice: 32.99,
    avgRating: 3.46,
    numReviews: 13,
    ratingDistribution: [
      { rating: 1, count: 1 },
      { rating: 2, count: 2 },
      { rating: 3, count: 3 },
      { rating: 4, count: 4 },
      { rating: 5, count: 3 },
    ],
    countInStock: 16,
    numSales: 56,
    description:
      'Heavyweight cotton (Heathers are 60% cotton/40% polyester; Pebblestone is 75% cotton/25% polyester)',
    sizes: ['XL', 'XXL'],
    colors: [{ name: 'Black' }, { name: 'White' }], // Updated to array of objects
    sellerId: 'jack.seller@example.com',
    sellerName: 'Jack Seller',
    warehouse: {
      provider: 'ShipBob',
      sku: 'HANE-TS-006',
      location: 'Los Angeles',
      lat: 34.0522,
      lon: -118.2437,
      availableQuantity: 16,
    },
    weight: 0.4,
    volume: 600,
    reviews: [],
  },
  // Jeans
  {
    name: 'Silver Jeans Co. Mens Jace Slim Fit Bootcut Jeans',
    slug: toSlug('Silver Jeans Co. Mens Jace Slim Fit Bootcut Jeans'),
    category: 'Jeans',
    brand: 'Silver Jeans Co',
    images: ['/images/p21-1.jpg', '/images/p21-2.jpg'],
    tags: ['new-arrival'],
    isPublished: true,
    price: 95.34,
    listPrice: 0,
    avgRating: 4.71,
    numReviews: 7,
    ratingDistribution: [
      { rating: 1, count: 0 },
      { rating: 2, count: 0 },
      { rating: 3, count: 0 },
      { rating: 4, count: 2 },
      { rating: 5, count: 5 },
    ],
    countInStock: 54,
    numSales: 21,
    description:
      'Silver Jeans Co. Jace Slim Fit Bootcut Jeans - Consider Jace a modern cowboy jean. It sits below the waist and features a slim fit through the hip and thigh. Finished with an 18” bootcut leg opening that complements the slimmer silhouette while still fitting over boots',
    sizes: ['30Wx30L', '34Wx30L', '36Wx30L'],
    colors: [{ name: 'Black' }, { name: 'White' }], // Updated to array of objects
    sellerId: 'john.seller@example.com',
    sellerName: 'John Seller',
    warehouse: {
      provider: 'ShipBob',
      sku: 'SLVR-JN-001',
      location: 'New York',
      lat: 40.7128,
      lon: -74.0060,
      availableQuantity: 54,
    },
    weight: 0.8,
    volume: 2000,
    reviews: [],
  },
  {
    name: "Levi's mens 505 Regular Fit Jeans (Also Available in Big & Tall)",
    slug: toSlug(
      "Levi's mens 505 Regular Fit Jeans (Also Available in Big & Tall)"
    ),
    category: 'Jeans',
    brand: "Levi's",
    images: ['/images/p22-1.jpg', '/images/p22-2.jpg'],
    tags: ['featured'],
    isPublished: true,
    price: 59.99,
    listPrice: 69.99,
    avgRating: 4.2,
    numReviews: 10,
    ratingDistribution: [
      { rating: 1, count: 1 },
      { rating: 2, count: 0 },
      { rating: 3, count: 0 },
      { rating: 4, count: 4 },
      { rating: 5, count: 5 },
    ],
    countInStock: 22,
    numSales: 54,
    description:
      'A veritable classic, this 505 is made to have a comfortable look and style.',
    sizes: ['30Wx30L', '34Wx30L', '36Wx30L'],
    colors: [{ name: 'Black' }, { name: 'White' }], // Updated to array of objects
    sellerId: 'jack.seller@example.com',
    sellerName: 'Jack Seller',
    warehouse: {
      provider: 'ShipBob',
      sku: 'LEVI-JN-002',
      location: 'Los Angeles',
      lat: 34.0522,
      lon: -118.2437,
      availableQuantity: 22,
    },
    weight: 0.7,
    volume: 1800,
    reviews: [],
  },
  {
    name: 'Essentials Mens Straight-Fit Stretch Jean',
    slug: toSlug('Essentials Mens Straight-Fit Stretch Jean'),
    category: 'Jeans',
    brand: 'Essentials',
    images: ['/images/p23-1.jpg', '/images/p23-2.jpg'],
    tags: ['best-seller'],
    isPublished: true,
    price: 38.9,
    listPrice: 45,
    avgRating: 4,
    numReviews: 12,
    ratingDistribution: [
      { rating: 1, count: 1 },
      { rating: 2, count: 0 },
      { rating: 3, count: 2 },
      { rating: 4, count: 4 },
      { rating: 5, count: 5 },
    ],
    countInStock: 23,
    numSales: 54,
    description:
      'These classic 5-pocket straight-fit jeans are crafted with a bit of stretch for additional comfort and to help maintain their shape',
    sizes: ['30Wx30L', '34Wx30L', '36Wx30L'],
    colors: [{ name: 'Black' }, { name: 'White' }], // Updated to array of objects
    sellerId: 'john.seller@example.com',
    sellerName: 'John Seller',
    warehouse: {
      provider: 'ShipBob',
      sku: 'ESSN-JN-003',
      location: 'New York',
      lat: 40.7128,
      lon: -74.0060,
      availableQuantity: 23,
    },
    weight: 0.7,
    volume: 1800,
    reviews: [],
  },
  {
    name: "Buffalo David Bitton Mens Men's Driven Relaxed Denim Jeans",
    slug: toSlug(
      "Buffalo David Bitton Mens Men's Driven Relaxed Denim Jeans"
    ),
    category: 'Jeans',
    brand: 'Buffalo David Bitton',
    images: ['/images/p24-1.jpg', '/images/p24-2.jpg'],
    tags: ['todays-deal'],
    isPublished: true,
    price: 69.99,
    listPrice: 100,
    avgRating: 3.85,
    numReviews: 14,
    ratingDistribution: [
      { rating: 1, count: 5 },
      { rating: 2, count: 2 },
      { rating: 3, count: 3 },
      { rating: 4, count: 4 },
      { rating: 5, count: 5 }
    ],
    countInStock: 24,
    numSales: 53,
    description: 'Stretch recycled denim jeans in an authentic and sanded wash blue. Features a comfortable low-rise waist with a relaxed fit at the leg. The distressed look gives these jeans an effortlessly worn-in feel. The eco-friendly logo patch in tan and red is at the back waistband. The signature maple leaf graphic is debossed at the zip-fly.',
    sizes: ['30Wx30L', '34Wx30L', '36Wx30L'],
    colors: [{ name: 'Black' }, { name: 'White' }], // Updated to array of objects
    sellerId: 'jack.seller@example.com',
    sellerName: 'Jack Seller',
    warehouse: {
      provider: 'ShipBob',
      sku: 'BUFF-JN-004',
      location: 'Los Angeles',
      lat: 34.0522,
      lon: -118.2437,
      availableQuantity: 24
    },
    weight: 0.0,
    volume: 2000,
    reviews: []
  },
  {
    name: 'Dickies Mens Relaxed Fit Carpenter Jean',
    slug: toSlug('Dickies Mens Relaxed Fit Carpenter Jean'),
    category: 'Jeans',
    brand: 'Dickies',
    images: ['/images/p25-1.jpg', '/images/p25-2.jpg'],
    tags: ['new-arrival', 'featured'],
    isPublished: true,
    price: 95.34,
    listPrice: 0,
    avgRating: 3.66,
    numReviews: 15,
    ratingDistribution: [
      { rating: 1 ,count: 1 },
      { rating: 2, count: 2 },
      { rating: 3, count: 3 },
      { rating: 4, count: 4 },
      { rating: 5, count: 5 },
    ],
    countInStock: 25,
    numSales: 48,
    description: 'Relaxed work jean with traditional carpenter-style pockets and logo patch at back pockets',
    sizes: ['30Wx30L', '34Wx30L', '36Wx30L'],
    colors: [{ name: 'Black' }, { name: 'White' }], // Updated to array of objects
    sellerId: 'john.seller@example.com',
    sellerName: 'John Seller',
    warehouse: {
      provider: 'ShipBob',
      sku: 'DICK-JN-005',
      location: 'New York',
      lat: 40.7128,
      lon: -74.0060,
      availableQuantity: 25,
    },
    weight: 0.8,
    volume: 2000,
    reviews: [],
  },
  {
    name: 'Wrangler mens Premium Performance Cowboy Cut Slim Fit Jean',
    slug: toSlug('Wrangler mens Premium Performance Cowboy Cut Slim Fit Jean'),
    category: 'Jeans',
    images: ['/images/p26-1.jpg', '/images/p26-2.jpg'],
    tags: ['best-seller', 'todays-deal'],
    isPublished: true,
    price: 81.99,
    listPrice: 149.99,
    avgRating: 3.46,
    numReviews: 13,
    ratingDistribution: [
      { rating: 1, count: 1 },
      { rating: 2, count: 2 },
      { rating: 3, count: 3 },
      { rating: 4, count: 4 },
      { rating: 5, count: 3 },
    ],
    countInStock: 26,
    numSales: 48,
    description:
      'Designed with a functional fit in mind, these jeans are made to stack over your favorite pair of boots. Constructed with a slim fit in the waist, seat, and thigh, this jean is designed for both function and comfort for long days in the saddle.',
    sizes: ['30Wx30L', '34Wx30L', '36Wx30L'],
    colors: [{ name: 'Black' }, { name: 'White' }], // Updated to array of objects
    sellerId: 'jack.seller@example.com',
    sellerName: 'Jack Seller',
    warehouse: {
      provider: 'ShipBob',
      sku: 'WRAN-JN-006',
      location: 'Los Angeles',
      lat: 34.0522,
      lon: -118.2437,
      availableQuantity: 26,
    },
    weight: 0.8,
    volume: 2000,
    reviews: [],
  },
  // Watches
  {
    name: "Seiko Men's Analogue Watch with Black Dial",
    slug: toSlug("Seiko Men's Analogue Watch with Black Dial"),
    category: 'Wrist Watches',
    brand: 'Seiko',
    images: ['/images/p31-1.jpg', '/images/p31-2.jpg'],
    tags: ['new-arrival'],
    isPublished: true,
    price: 530.0,
    listPrice: 0,
    avgRating: 4.71,
    numReviews: 7,
    ratingDistribution: [
      { rating: 1, count: 0 },
      { rating: 2, count: 0 },
      { rating: 3, count: 0 },
      { rating: 4, count: 2 },
      { rating: 5, count: 5 },
    ],
    countInStock: 31,
    numSales: 48,
    description:
      'Casing: Case made of stainless steel Case shape: round Case colour: silver Glass: Hardlex Clasp type: Fold over clasp with safety',
    sizes: [],
    colors: [],
    sellerId: 'john.seller@example.com',
    sellerName: 'John Seller',
    warehouse: {
      provider: 'ShipBob',
      sku: 'SEIK-WT-001',
      location: 'New York',
      lat: 40.7128,
      lon: -74.0060,
      availableQuantity: 31,
    },
    weight: 0.2,
    volume: 200,
    reviews: [],
  },
  {
    name: 'SEIKO 5 Sport SRPJ83 Beige Dial Nylon Automatic Watch, Beige, Automatic Watch',
    slug: toSlug(
      'SEIKO 5 Sport SRPJ83 Beige Dial Nylon Automatic Watch, Beige, Automatic Watch'
    ),
    category: 'Wrist Watches',
    brand: 'Seiko',
    images: ['/images/p32-1.jpg', '/images/p32-2.jpg'],
    tags: ['featured'],
    isPublished: true,
    price: 375.83,
    listPrice: 400,
    avgRating: 4.2,
    numReviews: 10,
    ratingDistribution: [
      { rating: 1, count: 1 },
      { rating: 2, count: 0 },
      { rating: 3, count: 0 },
      { rating: 4, count: 4 },
      { rating: 5, count: 5 },
    ],
    countInStock: 32,
    numSales: 48,
    description:
      'Seiko 5 Sports Collection Inspired by vintage field/aviator style: Automatic with manual winding capability',
    sizes: [],
    colors: [],
    sellerId: 'jack.seller@example.com',
    sellerName: 'Jack Seller',
    warehouse: {
      provider: 'ShipBob',
      sku: 'SEIK-WT-002',
      location: 'Los Angeles',
      lat: 34.0522,
      lon: -118.2437,
      availableQuantity: 32,
    },
    weight: 0.2,
    volume: 200,
    reviews: [],
  },
  {
    name: "Casio Men's Heavy Duty Analog Quartz Stainless Steel Strap, Silver, 42 Casual Watch",
    slug: toSlug(
      "Casio Men's Heavy Duty Analog Quartz Stainless Steel Strap, Silver, 42 Casual Watch"
    ),
    category: 'Wrist Watches',
    brand: 'Casio',
    images: ['/images/p33-1.jpg', '/images/p33-2.jpg'],
    tags: ['best-seller'],
    isPublished: true,
    price: 60.78,
    listPrice: 0,
    avgRating: 4,
    numReviews: 12,
    ratingDistribution: [
      { rating: 1, count: 1 },
      { rating: 2, count: 0 },
      { rating: 3, count: 2 },
      { rating: 4, count: 4 },
      { rating: 5, count: 5 },
    ],
    countInStock: 33,
    numSales: 48,
    description:
      'The Casio range is growing with this model MWA-100H-1AVEF. Sporting a stainless steel case with a brushed finish, it will easily withstand all the shocks of everyday life.',
    sizes: [],
    colors: [],
    sellerId: 'john.seller@example.com',
    sellerName: 'John Seller',
    warehouse: {
      provider: 'ShipBob',
      sku: 'CASI-WT-001',
      location: 'New York',
      lat: 40.7128,
      lon: -74.0060,
      availableQuantity: 33,
    },
    weight: 0.2,
    volume: 200,
    reviews: [],
  },
  {
    name: 'Casio Classic Silver-Tone Stainless Steel Band Date Indicator Watch',
    slug: toSlug(
      'Casio Classic Silver-Tone Stainless Steel Band Date Indicator Watch',
    ),
    category: 'Wrist Watches',
    brand: 'Casio',
    images: ['/images/p34-1.jpg', '/images/p34-2.jpg'],
    tags: ['todays-deal'],
    isPublished: true,
    price: 34.22,
    listPrice: 54.99,
    avgRating: 3.85,
    numReviews: 14,
    ratingDistribution: [
      { rating: 1, count: 0 },
      { rating: 2, count: 2 },
      { rating: 3, count: 3 },
      { rating: 4, count: 4 },
      { rating: 5, count: 5 },
    ],
    countInStock: 34,
    numSales: 48,
    description:
      'The new MTPVD01D-7EV is a classic 50 meter water resistant stainless steel band watch now updated with a white dial. This elegant 3-hand, date display timepiece is perfect for any setting.',
    sizes: [],
    colors: [{ name: 'Black' }, { name: 'White' }], // Updated to array of objects
    sellerId: 'jack.seller@example.com',
    sellerName: 'Jack Seller',
    warehouse: {
      provider: 'ShipBob',
      sku: 'CASI-WT-002',
      location: 'Los Angeles',
      lat: 34.0522,
      lon: -118.2437,
      availableQuantity: 34,
    },
    weight: 0.2,
    volume: 200,
    reviews: [],
  },
  {
    name: "Fossil Men's Grant Stainless Steel Quartz Chronograph Watch",
    slug: toSlug("Fossil Men's Grant Stainless Steel Quartz Chronograph Watch"),
    category: 'Wrist Watches',
    brand: 'Fossil',
    images: ['/images/p35-1.jpg', '/images/p35-2.jpg'],
    tags: ['new-arrival', 'featured'],
    isPublished: true,
    price: 171.25,
    listPrice: 225,
    avgRating: 3.66,
    numReviews: 15,
    ratingDistribution: [
      { rating: 1, count: 1 },
      { rating: 2, count: 2 },
      { rating: 3, count: 3 },
      { rating: 4, count: 4 },
      { rating: 5, count: 5 },
    ],
    countInStock: 35,
    numSales: 48,
    description:
      'Chronograph watch featuring silver- and blue-tone case, blue sunray dial, and silver-tone Roman numeral indices',
    sizes: [],
    colors: [{ name: 'Black' }, { name: 'White' }], // Updated to array of objects,
    sellerId: 'john.seller@example.com',
    sellerName: 'John Seller',
    warehouse: {
      provider: 'ShipBob',
      sku: 'FOSS-WT-001',
      location: 'New York',
      lat: 40.7128,
      lon: -74.0060,
      availableQuantity: 35,
    },
    weight: 0.25,
    volume: 250,
    reviews: [],
  },
  {
    name: "Fossil Men's Machine Stainless Steel Quartz Watch",
    slug: toSlug("Fossil Men's Machine Stainless Steel Quartz Watch"),
    category: 'Wrist Watches',
    brand: 'Fossil',
    images: ['/images/p36-1.jpg', '/images/p36-2.jpg'],
    tags: ['best-seller', 'todays-deal'],
    isPublished: true,
    price: 158.25,
    listPrice: 229.0,
    avgRating: 3.46,
    numReviews: 13,
    ratingDistribution: [
      { rating: 1, count: 1 },
      { rating: 2, count: 2 },
      { rating: 3, count: 3 },
      { rating: 4, count: 4 },
      { rating: 5, count: 3 },
    ],
    countInStock: 36,
    numSales: 49,
    description:
      'In masculine black-on-black, our industrial-inspired Machine watch will add a fresh, modern touch to your casual look. This Machine watch also features a three-hand movement on a stainless steel bracelet.',
    sizes: [],
    colors: [{ name: 'Black' }, { name: 'White' }], // Updated to array of objects
    sellerId: 'jack.seller@example.com',
    sellerName: 'Jack Seller',
    warehouse: {
      provider: 'ShipBob',
      sku: 'FOSS-WT-002',
      location: 'Los Angeles',
      lat: 34.0522,
      lon: -118.2437,
      availableQuantity: 36,
    },
    weight: 0.25,
    volume: 250,
    reviews: [],
  },
  // Sneakers
  {
    name: 'Adidas Mens Grand Court 2.0 Training Shoes',
    slug: toSlug('Adidas Mens Grand Court 2.0 Training Shoes'),
    category: 'Shoes',
    brand: 'Adidas',
    images: ['/images/p41-1.jpg', '/images/p41-2.jpg'],
    tags: ['new-arrival'],
    isPublished: true,
    price: 81.99,
    listPrice: 0,
    avgRating: 4.71,
    numReviews: 7,
    ratingDistribution: [
      { rating: 1, count: 0 },
      { rating: 2, count: 0 },
      { rating: 3, count: 0 },
      { rating: 4, count: 2 },
      { rating: 5, count: 5 },
    ],
    countInStock: 41,
    numSales: 48,
    description:
      'Cloudfoam Comfort sockliner is ultra-soft and plush, with two layers of cushioning topped with soft, breathable mesh',
    sizes: ['8', '9', '10'],
    colors: [{ name: 'Black' }, { name: 'White' }], // Updated to array of objects
    sellerId: 'john.seller@example.com',
    sellerName: 'John Seller',
    warehouse: {
      provider: 'ShipBob',
      sku: 'ADID-SH-001',
      location: 'New York',
      lat: 40.7128,
      lon: -74.0060,
      availableQuantity: 41,
    },
    weight: 0.0,
    volume: 1.0,
    reviews: [],
  },
  {
    name: "ziitop Men's Running Walking Shoes",
    slug: toSlug("ziitop Men's Running Walking Shoes"),
    category: 'Shoes',
    brand: 'ziitop',
    images: ['/images/p42-1.jpg', '/images/p42-2.jpg'],
    tags: ['featured'],
    isPublished: true,
    price: 39.97,
    listPrice: 49.95,
    avgRating: 4.2,
    numReviews: 10,
    ratingDistribution: [
      { rating: 1, count: 1 },
      { rating: 2, count: 0 },
      { rating: 3, count: 0 },
      { rating: 4, count: 4 },
      { rating: 5, count: 5 },
    ],
    countInStock: 42,
    numSales: 50,
    description:
      'Cloudfoam Comfort sockliner is ultra-soft and plush, with two layers of soft, breathable mesh',
    sizes: ['8', '9', '10'],
    colors: [{ name: 'Black' }, { name: 'White' }], // Updated to array of objects
    sellerId: 'jack.seller@example.com',
    sellerName: 'Jack Seller',
    warehouse: {
      provider: 'ShipBob',
      sku: 'ZIIT-SH-002',
      location: 'Los Angeles',
      lat: 34.0522,
      lon: -118.2437,
      availableQuantity: 42,
    },
    weight: 0.5,
    volume: 25,
    reviews: [],
  },
  {
    name: 'Skechers mens Summits High Range Hands Free Slip-in Shoes Work Shoe',
    slug: toSlug(
      'Skechers mens Summits High Range Hands Free Slip-in Shoes Work Shoe'
    ),
    category: 'Shoes',
    brand: 'Skechers',
    images: ['/images/p43-1.jpg', '/images/p43-2.jpg'],
    tags: ['best-seller'],
    isPublished: true,
    price: 99.99,
    listPrice: 0,
    avgRating: 4,
    numReviews: 12,
    ratingDistribution: [
      { rating: 1, count: 1 },
      { rating: 2, count: 0 },
      { rating: 3, count: 2 },
      { rating: 4, count: 4 },
      { rating: 5, count: 5 },
    ],
    countInStock: 43,
    numSales: 72,
    description:
      'Step into easy-wearing comfort with Skechers Hands Free Slip-ins™: Summits - High Range. Along with our exclusive Heel Pillow™ technology, this vegan style features a unique pop-up Skechers Slip-ins™ molded heel panel, a mesh upper with fixed laces.',
    sizes: ['8', '9', '10'],
    colors: [{ name: 'Black' }, { name: 'White' }], // Updated to array of objects
    sellerId: 'john.seller@example.com',
    sellerName: 'John Seller',
    warehouse: {
      provider: 'ShipBob',
      sku: 'SKECH-SH-003',
      location: 'New York',
      lat: 40.7128,
      lon: -74.0060,
      availableQuantity: 43,
    },
    weight: 0.6,
    volume: 45,
    reviews: [],
  },
  {
    name: 'DLWKIPV Mens Running Shoes Tennis Cross Training Sneakers',
    slug: toSlug(
      'DLWKIPV Mens Running Shoes Tennis Cross Training Sneakers'
    ),
    category: 'Shoes',
    brand: 'DLWKIPV',
    images: ['/images/p44-1.jpg', '/images/p44-2.jpg'],
    tags: ['todays-deal'],
    isPublished: true,
    price: 36.99,
    listPrice: 56.9,
    avgRating: 3.85,
    numReviews: 14,
    ratingDistribution: [
      { rating: 1, count: 0 },
      { rating: 2, count: 2 },
      { rating: 3, count: 3 },
      { rating: 4, count: 4 },
      { rating: 5, count: 5 },
    ],
    countInStock: 44,
    numSales: 72,
    description:
      'Design: Mesh vamp, ventilation. Sole anti-slip groove design, shock absorption and anti-slip. The inside of the shoe is wide and soft, bringing you a good comfortable experience',
    sizes: ['8', '9', '10', '11', '12'],
    colors: [{ name: 'Black' }, { name: 'White' }], // Updated to array of objects
    sellerId: 'jack.seller@example.com',
    sellerName: 'Jack Seller',
    warehouse: {
      provider: 'ShipBob',
      sku: 'DLWK-SH-004',
      location: 'Los Angeles',
      lat: 34.0522,
      lon: -118.2437,
      availableQuantity: 44,
    },
    weight: 0.5,
    volume: 40,
    reviews: [],
  },
  {
    name: "ASICS Men's GT-2000 13 Running Shoes",
    slug: toSlug("ASICS Men's GT-2000 13 Running Shoes"),
    category: 'Shoes',
    brand: 'ASICS',
    images: ['/images/p45-1.jpg', '/images/p45-2.jpg'],
    tags: ['new-arrival', 'featured'],
    isPublished: true,
    price: 179.95,
    listPrice: 200,
    avgRating: 3.66,
    numReviews: 15,
    ratingDistribution: [
      { rating: 1, count: 1 },
      { rating: 2, count: 2 },
      { rating: 3, count: 3 },
      { rating: 4, count: 4 },
      { rating: 5, count: 5 },
    ],
    countInStock: 45,
    numSales: 75,
    description:
      "At least 50% of the shoe's main upper material is made with recycled content to reduce waste and carbon emissions",
    sizes: ['8', '9', '10', '11'],
    colors: [{ name: 'Black' }, { name: 'White' }], // Updated to array of objects
    sellerId: 'john.seller@example.com',
    sellerName: 'John Seller',
    warehouse: {
      provider: 'ShipBob',
      sku: 'ASIC-SH-005',
      location: 'New York',
      lat: 40.7128,
      lon: -74.0060,
      availableQuantity: 45,
    },
    weight: 0.6,
    volume: 45,
    reviews: [],
  },
  {
    name: "Mens Wearbreeze Shoes, Urban - Ultra Comfortable Shoes",
    slug: toSlug(
      "Mens Wearbreeze Shoes, Urban - Ultra Comfortable Shoes"
    ),
    category: 'Shoes',
    brand: 'Generic',
    images: ['/images/p46-1.jpg', '/images/p46-2.jpg'],
    tags: ['best-seller', 'todays-deal'],
    isPublished: true,
    price: 32.99,
    listPrice: 80,
    avgRating: 3.46,
    numReviews: 13,
    ratingDistribution: [
      { rating: 1, count: 1 },
      { rating: 2, count: 2 },
      { rating: 3, count: 3 },
      { rating: 4, count: 4 },
      { rating: 5, count: 3 },
    ],
    countInStock: 46,
    numSales: 48,
    description:
      'Cloudfoam Comfort sockliner is ultra-soft and plush, with two layers of cushioning topped with soft, breathable mesh',
    sizes: ['8', '9', '10', '11'],
    colors: [{ name: 'Black' }, { name: 'White' }], // Updated to array of objects
    sellerId: 'jack.seller@example.com',
    sellerName: 'Jack Seller',
    warehouse: {
      provider: 'ShipBob',
      sku: 'GENR-SH-006',
      location: 'Los Angeles',
      lat: 34.0522,
      lon: -118.2437,
      availableQuantity: 46,
    },
    weight: 0.5,
    volume: 40,
    reviews: [],
  },
]

const reviews: IReviewInput[] = [
  {
    user: 'john.doe@example.com',
    rating: 1,
    title: 'Poor Quality',
    comment: 'Very disappointed. The item broke after just a few uses. Not worth the money.',
    isVerifiedPurchase: true,
    product: 'Sample Product',
  },
  {
    user: 'jane.smith@example.com',
    rating: 2,
    title: 'Disappointed',
    comment: "Not as expected. The material feels cheap, and it didn't fit well. Wouldn't buy again.",
    isVerifiedPurchase: true,
    product: 'Sample Product',
  },
  {
    user: 'mike.jones@example.com',
    rating: 2,
    title: 'Needs Improvement',
    comment: "It looks nice but doesn't perform as expected. Wouldn't recommend without upgrades.",
    isVerifiedPurchase: true,
    product: 'Sample Product',
  },
  {
    user: 'sarah.wilson@example.com',
    rating: 3,
    title: 'Not Bad',
    comment: 'This product is decent, the quality is good but it could use some improvements in the details.',
    isVerifiedPurchase: true,
    product: 'Sample Product',
  },
  {
    user: 'david.brown@example.com',
    rating: 3,
    title: 'Okay',
    comment: 'It works, but not as well as I hoped. Quality is average and lacks some finishing.',
    isVerifiedPurchase: true,
    product: 'Sample Product',
  },
  {
    user: 'lisa.taylor@example.com',
    rating: 4,
    title: 'Very Satisfied',
    comment: 'Good product! High quality and worth the price. Would consider buying again.',
    isVerifiedPurchase: true,
    product: 'Sample Product',
  },
  {
    user: 'robert.miller@example.com',
    rating: 4,
    title: 'Absolutely Love It!',
    comment: 'Perfect in every way! The quality, design, and comfort exceeded all my expectations.',
    isVerifiedPurchase: true,
    product: 'Sample Product',
  },
  {
    user: 'emma.davis@example.com',
    rating: 5,
    title: 'Excellent Choice!',
    comment: 'This product is outstanding! Everything about it feels top-notch, from material to performance.',
    isVerifiedPurchase: true,
    product: 'Sample Product',
  },
  {
    user: 'thomas.white@example.com',
    rating: 5,
    title: "Couldn't Ask for More!",
    comment: 'Love this product! It is durable, stylish, and works great. Would buy again without upgrades.',
    isVerifiedPurchase: true,
    product: 'Sample Product',
  },
]

const data: Data = {
  users,
  products,
  reviews,
  webPages: [
    {
      title: 'About Us',
      slug: 'about-us',
      content: `Welcome to MGZON, your trusted destination for premium products and exceptional service. Our journey began with a mission to bring you the best shopping experience by offering a wide range of products at competitive prices, all in one convenient platform.

At MGZON, we prioritize customer satisfaction and innovation. Our team works tirelessly to curate a diverse selection of items, from everyday essentials to exclusive deals, ensuring there's something for everyone. We also strive to make your shopping experience seamless with fast shipping, secure payments, and excellent customer support.

As we continue to grow, our commitment to quality and service remains unwavering. Thank you for choosing MGZON—we look forward to being a part of your journey and delivering value every step of the way.`,
      isPublished: true,
    },
    {
      title: 'Contact Us',
      slug: 'contact-us',
      content: `We’re here to help! If you have any questions, concerns, or feedback, please don’t hesitate to reach out to us. Our team is ready to assist you and ensure you have the best shopping experience.

**Customer Support**
For inquiries about orders, products, or account-related issues, contact our customer support team:
- **Email:** support@example.com
- **Phone:** +1 (123) 456-7890
- **Live Chat:** Available on our website from 9 AM to 6 PM (Monday to Saturday).

**Head Office**
For corporate or business-related inquiries, reach out to our headquarters:
- **Address:** 1234 E-Commerce Blvd, Suite 789, Business City, CA 12345
- **Phone:** +1 (987) 654-3210

We look forward to assisting you! Your satisfaction is our priority.`,
      isPublished: true,
    },
    {
      title: 'Help',
      slug: 'help',
      content: `Welcome to MGZON's Help Center! We're here to assist you with any questions or concerns you may have while shopping with us. Whether you need help with orders, account management, or product inquiries, this page provides all the information you need to navigate our platform with ease.

**Placing and Managing Orders**
Placing an order is simple and secure. Browse our product categories, add items to your cart, and proceed to checkout. Once your order is placed, you can track its status through your account under the "My Orders" section. If you need to modify or cancel your order, please contact us as soon as possible for assistance.

**Shipping and Returns**
We offer a variety of shipping options to suit your needs, with costs and delivery times displayed at checkout based on your location and order details. For detailed shipping policies, visit our Shipping Policy page. If you're not satisfied with your purchase, our hassle-free return process allows you to initiate a return within 30 days. Check our Returns Policy for more details.

**Account and Support**
Managing your account is easy. Log in to update your personal information, payment methods, and saved addresses. If you encounter any issues or need further assistance, our customer support team is available via email, live chat, or phone. Visit our Contact Us page for support hours and contact details.`,
      isPublished: true,
    },
    {
      title: 'Privacy Policy',
      slug: 'privacy-policy',
      content: `At MGZON, we value your privacy and are committed to protecting your personal information. This Privacy Policy explains how we collect, use, and share your data when you interact with our services. By using our platform, you consent to the practices described herein.

We collect data such as your name, email address, and payment details to provide you with tailored services and improve your experience. This information may be used for marketing purposes, but only with your explicit consent. We may share your data with trusted third-party providers to facilitate transactions or deliver products.

Your data is safeguarded through industry-standard security measures to prevent unauthorized access. You have the right to access, correct, or delete your personal information at any time. For inquiries or concerns regarding your privacy, please contact our support team at support@example.com.`,
      isPublished: true,
    },
    {
      title: 'Conditions of Use',
      slug: 'conditions-of-use',
      content: `Welcome to MGZON. By accessing or using our website, you agree to comply with and be bound by the following terms and conditions. These terms govern your use of our platform, including browsing, purchasing products, and interacting with any content or services provided. You must be at least 18 years old or have the legal consent of a parent or guardian to use this website. Any violation of these terms may result in the termination of your access to our platform.

We strive to ensure all product descriptions, prices, and availability information on our website are accurate. However, errors may occur, and we reserve the right to correct them without prior notice. All purchases are subject to our return and refund policy. By using our site, you acknowledge that your personal information will be processed according to our privacy policy, ensuring your data is handled responsibly and securely.`,
      isPublished: true,
    },
    {
      title: 'Customer Service',
      slug: 'customer-service',
      content: `At MGZON, our customer service team is dedicated to ensuring you have the best shopping experience. Whether you need assistance with orders, product details, or returns, we are committed to providing prompt and helpful support.

If you have questions or concerns, please reach out to us through our multiple contact options:
- **Email:** support@example.com
- **Phone:** +1 (123) 456-7890
- **Live Chat:** Available on our website from 9 AM to 6 PM (Monday to Saturday)

We also provide helpful resources such as order tracking, product guides, and FAQs to assist you with common inquiries. Your satisfaction is our priority, and we’re here to resolve any issues quickly and efficiently. Thank you for choosing MGZON!`,
      isPublished: true,
    },
    {
      title: 'Returns Policy',
      slug: 'returns-policy',
      content: `At MGZON, we want you to be completely satisfied with your purchase. If you’re not happy with your order, you can return eligible items within 30 days of delivery for a full refund or exchange, provided the items are unused, in their original packaging, and in the same condition as received.

To initiate a return, log into your account, go to the "My Orders" section, and follow the return instructions. Shipping costs for returns are covered by the customer unless the item is defective or incorrect. Once we receive and inspect the returned item, we’ll process your refund within 5-7 business days.

For more details, including exceptions and conditions, please contact our customer support team at support@example.com.`,
      isPublished: true,
    },
    {
      title: 'Careers',
      slug: 'careers',
      content: `Join the MGZON team and be part of a dynamic company that’s shaping the future of e-commerce! We’re always looking for passionate, innovative individuals to join our growing team. At MGZON, we offer opportunities in various fields, including technology, customer service, logistics, and marketing, marketing, and more.

We value diversity, creativity, and a commitment to excellence. Explore our current job openings and apply online through our careers portal. If you don’t see a role that matches your skills, feel free to send us your resume for future opportunities at [careers@example.com].

Thank you for considering a career with MGZON!`,
      isPublished: true,
    },
    {
      title: 'Blog',
      slug: `blog`,
      content: `Welcome to the MGZON Blog! Stay updated with the latest news, product spotlights, style guides, and shopping tips to enhance your experience. Our blog is your go-to resource for tips and tricks on making the most of our platform, industry trends, and stories from our community.

From seasonal gift ideas to tech tips for seamless shopping, our articles are designed to inform and inspire you. Subscribe to our newsletter to receive the latest posts directly in your inbox and never miss an update!`,
      isPublished: true,
    },
    {
      title: 'Sell Products',
      slug: 'sell-products',
      content: `Become a seller on MGZON and reach thousands of customers worldwide! Our platform makes it easy for businesses and individuals to list and sell their products with ease. Whether you’re a small business owner, a craftsman, or a large retailer, MGZON offers tools to help you manage your store, track sales, and grow your brand effortlessly.

To get started, create a seller account, list your products, and start selling today. We provide competitive commission rates, secure payment processing, and access to our logistics network for seamless order fulfillment. fulfillment and delivery.

For more information on becoming a seller, visit our Seller Center or contact our seller support team at sales@example.com.`,
      isPublished: true,
    },
    {
      title: 'Become an Affiliate',
      slug: 'become-affiliate',
      content: `Join the MGZON Affiliate Program and earn commissions by promoting our products! As an affiliate, you’ll receive unique links to share on your website, blog, or social media platforms. When customers make purchases through your links, you’ll earn a percentage of each sale.

Our program offers competitive commission rates, real-time tracking, and a wide range of promotional products to promote. tools to help you succeed. Sign up for our affiliate program today and start earning with MGZON!

For more information, or to apply, visit our Affiliate Program page or contact us at affiliates@example.com].`,
      isPublished: true,
    },
    {
      title: 'Advertise Your Products',
      slug: 'advertise-products',
      content: `Boost your product visibility with MGZON’s advertising solutions! Our targeted advertising platform allows you to promote your products to the right audience, increasing your sales and brand awareness. Whether you’re a seller on our platform or an external vendor, we offer a variety of ad formats to suit your needs.

Choose from sponsored product listings, banner ads, or featured placements on our homepage. With detailed analytics and flexible budgeting options, you can track your campaign’s performance and optimize for maximum ROI.

To learn more about advertising opportunities, contact our advertising team at [ads@example.com].`,
      isPublished: true,
    },
    {
      title: 'Shipping Rates & Policies',
      slug: 'shipping-policies',
      content: `At MGZON, we strive to provide fast, reliable, and affordable shipping options to our customers worldwide. Shipping costs and delivery times are calculated dynamically at checkout based on your location, the product’s weight, dimensions, and the warehouse it’s shipped from. You’ll see all available shipping options and estimated delivery dates before completing your order.

**Free Shipping**: Orders over $35 qualify for free standard shipping within the USA. For international orders, free shipping thresholds may vary by country.

**Shipping Options**: We offer standard, expedited, and express shipping. Delivery times range from 1-10 days, depending on your location and selected method.

**International Shipping**: We ship to over 100 countries. Customs fees and import duties, if applicable, are the responsibility of the customer and will be displayed at checkout.

For more details or assistance with shipping, contact our support team at support@example.com.`,
      isPublished: true,
    },
  ],
  headerMenus: [
    {
      name: "Today's Deal",
      href: '/search?tag=todays-deal',
    },
    {
      name: 'New Arrivals',
      href: '/search?tag=new-arrival',
    },
    {
      name: 'Featured Products',
      href: '/search?tag=featured',
    },
    {
      name: 'Best Sellers',
      href: '/search?tag=best-seller',
    },
    {
      name: 'Browsing History',
      href: '/#browsing-history',
    },
    {
      name: 'Customer Service',
      href: '/page/customer-service',
    },
    {
      name: 'About Us',
      href: '/about',
    },



    {
      name: 'Help',
      href: '/docs/support',
    },
  ],
  carousels: [
    {
      title: 'Most Popular Shoes For Sale',
      buttonCaption: 'Shop Now',
      image: '/images/banner3.jpg',
      url: '/search?category=Shoes',
      isPublished: true,
    },
    {
      title: 'Best Sellers in T-Shirts',
      buttonCaption: 'Shop Now',
      image: '/images/banner1.jpg',
      url: '/search?category=T-Shirts',
      isPublished: true,
    },
    {
      title: 'Best Deals on Wrist Watches',
      buttonCaption: 'See More',
      image: '/images/banner2.jpg',
      url: '/search?category=Wrist Watches',
      isPublished: true,
    },
  ],
  settings: [
    {
      common: {
        freeShippingMinPrice: 35,
        isMaintenanceMode: false,
        defaultTheme: 'Light',
        defaultColor: 'Gold',
        pageSize: 9,
      },
      site: {
        name: 'MGZON',
        description:
          'MGZON is a sample Ecommerce website built with Next.js, Tailwind CSS, and MongoDB.',
        keywords: 'Ecommerce, Next.js, Tailwind CSS, MongoDB, MGZON',
        url: 'https://hager-zon.vercel.app',
        logo: '/icons/logo.svg',
        slogan: 'Spend less, enjoy more.',
        author: 'MGZON Team',
        copyright: '2000-2025, MGZON.com, Inc. or its affiliates',
        email: 'admin@mgzon.com',
        address: '123 Main Street, Anytown, CA, Zip 12345',
        phone: '+1 (123) 456-7890',
      },
      carousels: [
        {
          title: 'Most Popular Shoes For Sale',
          buttonCaption: 'Shop Now',
          image: '/images/banner3.jpg',
          url: '/search?category=Shoes',
          isPublished: true,
        },
        {
          title: 'Best Sellers in T-Shirts',
          buttonCaption: 'Shop Now',
          image: '/images/banner1.jpg',
          url: '/search?category=T-Shirts',
          isPublished: true,
        },
        {
          title: 'Best Deals on Wrist Watches',
          buttonCaption: 'See More',
          image: '/images/banner2.jpg',
          url: '/search?category=Wrist Watches',
          isPublished: true,
        },
      ],
      availableLanguages: i18n.locales.map((locale) => ({
        code: locale.code,
        name: locale.name,
      })),
      defaultLanguage: 'en-US',
      availableCurrencies: [
        {
          name: 'United States Dollar',
          code: 'USD',
          symbol: '$',
          convertRate: 1,
        },
        { name: 'Euro', code: 'EUR', symbol: '€', convertRate: 0.96 },
        { name: 'UAE Dirham', code: 'AED', symbol: 'AED', convertRate: 3.67 },
      ],
      defaultCurrency: 'USD',
      availablePaymentMethods: [
        { name: 'PayPal', commission: 0 },
        { name: 'Stripe', commission: 0 },
        { name: 'Cash On Delivery', commission: 0 },
      ],
      defaultPaymentMethod: 'PayPal',
      availableDeliveryDates: [
        {
          name: 'Standard Shipping',
          daysToDeliver: 0, // Dynamically calculated
          shippingPrice: 0, // Dynamically calculated
          freeShippingMinPrice: 35,
        },
        {
          name: 'Express Shipping',
          daysToDeliver: 0, // Dynamically calculated
          shippingPrice: 0, // Dynamically calculated
          freeShippingMinPrice: 0,
        },
      ],
      defaultDeliveryDate: 'Standard Shipping',
    },
  ],
}

export default data
export { calculateShipping }