import { cwd } from 'process';
import { loadEnvConfig } from '@next/env';
import bcrypt from 'bcryptjs';
import data from '@/lib/data';
// import { connectToDatabase } from '.';
import User from './models/user.model';
import Product from './models/product.model';
import Review from './models/review.model';
import WebPage from './models/web-page.model';
import Setting from './models/setting.model';
// import Order from './models/order.model';
import Seller from './models/seller.model';
import {
  calculateFutureDate,
  calculatePastDate,
  generateId,
  round2,
} from '../utils';
import { OrderItem, IOrderInput, ShippingAddress } from '@/types';
import { Order } from './models/order.model';
import { connectToDatabase } from '.';

// Load environment variables
loadEnvConfig(cwd());

// Validate data before seeding
const validateData = () => {
  if (!data.users?.length) throw new Error('No users provided in data');
  if (!data.products?.length) throw new Error('No products provided in data');
  if (!data.settings?.length) throw new Error('No settings provided in data');
  if (!data.webPages?.length) throw new Error('No web pages provided in data');
  console.log('Data validation passed');
};

// Helper function to generate seller data
const generateSellerData = (user: any, index: number) => {
  const currentDate = new Date();
  const fiveDaysFromNow = new Date(currentDate.getTime() + 5 * 24 * 60 * 60 * 1000);
  const defaultAddress = {
    street: `${1234 + index} Business Street`,
    city: 'Sample City',
    state: 'Sample State',
    country: 'United States',
    postalCode: `${10000 + index}`,
    phone: `+1${Math.floor(1000000000 + Math.random() * 9000000000)}`,
  };

  return {
    userId: user._id.toString(),
    businessName: `${user.name}'s Store`,
    businessType: 'individual',
    email: user.email,
    phone: user.address?.phone || defaultAddress.phone,
    description: `${user.name}'s Online Store`,
    vatRegistered: false,
    address: {
      street: user.address?.street || defaultAddress.street,
      city: user.address?.city || defaultAddress.city,
      state: user.address?.state || defaultAddress.state,
      country: user.address?.country || defaultAddress.country,
      postalCode: user.address?.postalCode || defaultAddress.postalCode,
    },
    taxId: `TAX${1000 + index}`,
    bankInfo: {
      accountName: `${user.name}'s Business Account`,
      accountNumber: `${1000000000 + index}`,
      bankName: 'Sample Bank',
      swiftCode: `SWIFT${1000 + index}`,
      verified: false,
    },
    subscription: {
      plan: 'Trial',
      startDate: currentDate,
      endDate: fiveDaysFromNow,
      status: 'active',
      features: {
        productsLimit: 50,
        commission: 7,
        prioritySupport: false,
        instantPayouts: false,
      },
      payments: [], // Add payments array for future use
      pointsRedeemed: 0,
    },
    verification: {
      status: 'pending',
      documents: new Map(),
      submittedAt: currentDate,
      verifiedAt: null,
    },
    metrics: {
      rating: 0,
      totalSales: 0,
      totalRevenue: 0,
      productsCount: 0,
      ordersCount: 0,
      customersCount: 0,
      views: 0,
      followers: 0,
      products: { total: 0, active: 0, outOfStock: 0 },
    },
    settings: {
      notifications: {
        email: true,
        sms: false,
        orderUpdates: true,
        marketingEmails: false,
        pointsNotifications: true,
      },
      display: {
        showRating: true,
        showContactInfo: true,
        showMetrics: true,
        showPointsBalance: true,
      },
      security: {
        twoFactorAuth: false,
        loginNotifications: true,
      },
      customSite: { theme: 'default', primaryColor: '#000000' },
    },
    pointsBalance: 50,
    pointsTransactions: [
      {
        amount: 50,
        type: 'earn',
        description: 'Welcome Bonus',
        createdAt: currentDate,
      },
    ],
    freeTrialActive: true,
    freeTrialEndDate: fiveDaysFromNow,
    trialMonthsUsed: 0,
    customSiteUrl: `/seller/${user._id.toString()}`,
    createdAt: currentDate,
    updatedAt: currentDate,
  };
};

// Function to generate order data
const generateOrder = async (
  i: number,
  users: string[],
  products: string[]
): Promise<IOrderInput> => {
  // تحديد المنتجات بناءً على الفهرس
  const productIds = [0, 1, 2].map((offset) => {
    const index = i % products.length;
    return products[
      index >= products.length - offset ? index - offset : index + offset
    ] || products[index]; // Fall-back لتجنب القيمة undefined
  });

  // تحميل المنتجات بشكل غير متزامن
  const [p1, p2, p3] = await Promise.all(
    productIds.map((id) => Product.findById(id))
  );

  // تحقق من أن جميع المنتجات موجودة في قاعدة البيانات
  if (!p1 || !p2 || !p3) throw new Error('Product not found');

  // إعداد العناصر في الطلب بناءً على المنتجات
  const items: OrderItem[] = [p1, p2, p3].map((p, idx) => ({
    clientId: generateId(),
    product: p._id,
    name: p.name,
    slug: p.slug,
    quantity: idx + 1,
    image: p.images[0] || 'default-image.jpg',
    category: p.category,
    price: p.price,
    countInStock: p.countInStock,
  }));

  // تحديد المستخدم (الأمر الذي سينشئ الطلب له)
  const userIndex = i % users.length;
  const baseUser = data.users[userIndex] || {};
  
  // العنوان الافتراضي في حالة عدم وجود عنوان للمستخدم
  const defaultAddress: ShippingAddress = {
    fullName: 'mark elasfar',
    street: '123 Main St',
    city: 'Sample City',
    province: 'Sample State',
    country: 'Sample Country',
    postalCode: '12345',
    phone: '+1234567890',
  };

  // العودة بالطلب مع كافة التفاصيل المحسوبة
  return {
    user: users[userIndex],
    items,
    shippingAddress: baseUser.address || defaultAddress,
    paymentMethod: baseUser.paymentMethod || 'Credit Card',
    isPaid: true,
    isDelivered: true,
    paidAt: calculatePastDate(i),
    deliveredAt: calculatePastDate(i),
    createdAt: calculatePastDate(i),
    expectedDeliveryDate: calculateFutureDate(i % 2),
    ...calcDeliveryDateAndPriceForSeed({
      items,
      shippingAddress: baseUser.address || defaultAddress,
      deliveryDateIndex: i % 2,
    }),
  };
};

// دالة لحساب تاريخ الشحن والسعر للطلب
export const calcDeliveryDateAndPriceForSeed = ({
  items,
  deliveryDateIndex,
  shippingAddress,
}: {
  deliveryDateIndex?: number;
  items: OrderItem[];
  shippingAddress?: ShippingAddress;
}) => {
  // الحصول على تواريخ الشحن من إعدادات التطبيق
  const { availableDeliveryDates } = data.settings[0] || { availableDeliveryDates: [] };
  
  // حساب سعر المنتجات
  const itemsPrice = round2(
    items.reduce((acc, item) => acc + item.price * item.quantity, 0)
  );

  // تحديد تاريخ الشحن وسعره بناءً على الـ deliveryDateIndex
  const deliveryDate = availableDeliveryDates[
    deliveryDateIndex ?? availableDeliveryDates.length - 1
  ] || { shippingPrice: 0 };

  // حساب الأسعار
  const shippingPrice = deliveryDate.shippingPrice || 0;
  const taxPrice = round2(itemsPrice * 0.15);  // الضرائب 15%
  const totalPrice = round2(itemsPrice + shippingPrice + taxPrice);

  // إرجاع كافة التفاصيل المحسوبة
  return {
    availableDeliveryDates,
    deliveryDateIndex: deliveryDateIndex ?? availableDeliveryDates.length - 1,
    itemsPrice,
    shippingPrice,
    taxPrice,
    totalPrice,
  };
};


// Main seeding function
const main = async () => {
  try {
    // Validate data
    validateData();

    // Connect to the database
    await connectToDatabase(process.env.MONGODB_URI);

    // الحصول على البيانات من الـ data
    const { users, products, reviews, webPages, settings } = data;

    console.log('Starting database seed...');

    // Seed users with bulk operations
    console.log('Seeding users...');
    const userOperations = users.map((user) => ({
      updateOne: {
        filter: { email: user.email },
        update: {
          $set: {
            ...user,
            password: user.password.startsWith('$2a')
              ? user.password
              : bcrypt.hashSync(user.password, 10),
          },
        },
        upsert: true,
      },
    }));
    await User.bulkWrite(userOperations);
    const createdUsers = await User.find({ email: { $in: users.map((u) => u.email) } });
    console.log(`Seeded ${createdUsers.length} users`);

    // Seed sellers (Filter users with role SELLER)
    console.log('Seeding sellers...');
    const sellerOperations = createdUsers
      .filter((u) => u.role === 'SELLER')
      .map((user, index) => ({
        updateOne: {
          filter: { userId: user._id.toString() },
          update: { $set: generateSellerData(user, index) },
          upsert: true,
        },
      }));
    if (sellerOperations.length) {
      await Seller.bulkWrite(sellerOperations);
    }
    const createdSellers = await Seller.find({
      userId: { $in: createdUsers.filter((u) => u.role === 'SELLER').map((u) => u._id.toString()) },
    });
    console.log(`Seeded ${createdSellers.length} sellers`);

    // Seed settings
    console.log('Seeding settings...');
    const settingOperations = settings
      .filter((setting: any) => setting.key)
      .map((setting: any) => ({
        updateOne: {
          filter: { key: setting.key },
          update: { $set: setting },
          upsert: true,
        },
      }));
    if (settingOperations.length) {
      await Setting.bulkWrite(settingOperations);
    }
    console.log('Seeded settings');

    // Seed web pages
    console.log('Seeding web pages...');
    const webPageOperations = webPages.map((page) => ({
      updateOne: {
        filter: { slug: page.slug },
        update: { $set: page },
        upsert: true,
      },
    }));
    if (webPageOperations.length) {
      await WebPage.bulkWrite(webPageOperations);
    }
    console.log('Seeded web pages');

    // Seed products with seller reference
    console.log('Seeding products...');
    const firstSeller = createdSellers[0] || (await Seller.findOne());
    if (!firstSeller) throw new Error('No seller found for product assignment');
    const productOperations = products.map((product) => {
      const { _id, ...rest } = product;
      return {
        updateOne: {
          filter: { slug: product.slug },
          update: {
            $set: {
              ...rest,
              sellerId: firstSeller.userId,
              seller: {
                name: firstSeller.businessName,
                email: firstSeller.email,
                subscription: firstSeller.subscription.plan,
              },
              warehouse: {
                provider: 'ShipBob',
                sku: generateId(),
                availableQuantity: product.countInStock,
              },
              pricing: {
                basePrice: product.price,
                markup: 30,
                profit: product.price * 0.2,
                commission: 10,
                finalPrice: product.price * 1.3,
                discount: { type: 'none', value: 0 },
              },
            },
          },
          upsert: true,
        },
      };
    });
    if (productOperations.length) {
      await Product.bulkWrite(productOperations);
    }
    const createdProducts = await Product.find({ slug: { $in: products.map((p) => p.slug) } });
    console.log(`Seeded ${createdProducts.length} products`);

    // Seed reviews
    console.log('Seeding reviews...');
    const allUsers = await User.find({});
    const reviewOperations = [];
    for (let i = 0; i < createdProducts.length; i++) {
      let x = 0;
      const { ratingDistribution } = createdProducts[i];
      for (let j = 0; j < ratingDistribution?.length; j++) {
        for (let k = 0; k < (ratingDistribution[j]?.count || 0); k++) {
          x++;
          const reviewTemplate = reviews.filter((r) => r.rating === j + 1);
          if (reviewTemplate.length === 0) continue;
          const review = {
            ...reviewTemplate[x % reviewTemplate.length],
            isVerifiedPurchase: true,
            product: createdProducts[i]._id,
            user: allUsers[x % allUsers.length]._id,
            updatedAt: new Date(),
            createdAt: new Date(),
          };
          reviewOperations.push({
            updateOne: {
              filter: {
                product: review.product,
                user: review.user,
                rating: review.rating,
              },
              update: { $set: review },
              upsert: true,
            },
          });
        }
      }
    }
    if (reviewOperations.length) {
      await Review.bulkWrite(reviewOperations);
    }
    console.log('Seeded reviews');

    // Seed orders
    console.log('Seeding orders...');
    const orderOperations = [];
    for (let i = 0; i < 200; i++) {
      const order = await generateOrder(
        i,
        allUsers.map((u) => u._id.toString()),
        createdProducts.map((p) => p._id.toString())
      );
      orderOperations.push({
        updateOne: {
          filter: { userId: order.user, createdAt: order.createdAt },
          update: { $set: order },
          upsert: true,
        },
      });
    }
    if (orderOperations.length) {
      await Order.bulkWrite(orderOperations);
    }
    console.log('Seeded orders');

    console.log('✅ Database seeded successfully without deleting existing data');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to seed database:', error);
    process.exit(1);
  }
};


// Execute the main function
main();