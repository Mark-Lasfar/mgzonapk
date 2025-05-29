/* eslint-disable @typescript-eslint/no-explicit-any */
import data from '@/lib/data';
import { connectToDatabase } from '.';
import User from './models/user.model';
import Product from './models/product.model';
import Review from './models/review.model';
import WebPage from './models/web-page.model';
import Setting from './models/setting.model';
import Order from './models/order.model';
import Seller from './models/seller.model';
import {
  calculateFutureDate,
  calculatePastDate,
  generateId,
  round2,
} from '../utils';
import { cwd } from 'process';
import { loadEnvConfig } from '@next/env';
import { OrderItem, IOrderInput, ShippingAddress } from '@/types';

loadEnvConfig(cwd());

const main = async () => {
  try {
    await connectToDatabase(process.env.MONGODB_URI);
    const { users, products, reviews, webPages, settings } = data;

    // تهيئة المستخدمين (بما في ذلك الإداريين)
    for (const user of users) {
      await User.updateOne(
        { email: user.email },
        { $set: user },
        { upsert: true }
      );
      console.log(`تم تهيئة المستخدم: ${user.email} بدور: ${user.role}`);
    }

    // تهيئة البائعين
    const allUsers = await User.find({});
    for (const user of allUsers.filter((u) => u.role === 'SELLER')) {
      const defaultAddress = {
        street: '123 Main St',
        city: 'Sample City',
        province: 'Sample State',
        country: 'Sample Country',
        postalCode: '12345',
        phone: '+1234567890',
      };

      await Seller.updateOne(
        { userId: user._id.toString() },
        {
          userId: user._id.toString(),
          businessName: `${user.name}'s Business`,
          email: user.email,
          phone: user.address?.phone || defaultAddress.phone,
          businessType: 'individual',
          vatRegistered: false,
          address: {
            street: user.address?.street || defaultAddress.street,
            city: user.address?.city || defaultAddress.city,
            state: user.address?.province || defaultAddress.province,
            country: user.address?.country || defaultAddress.country,
            postalCode: user.address?.postalCode || defaultAddress.postalCode,
          },
          taxId: 'TAX123456',
          bankInfo: {
            accountName: `${user.name}'s Account`,
            accountNumber: '1234567890',
            bankName: 'Default Bank',
            swiftCode: 'SWFT1234',
            verified: false,
          },
          subscription: {
            plan: 'Trial',
            startDate: new Date(),
            endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 أيام
            status: 'active',
            features: {
              productsLimit: 50,
              commission: 7,
              prioritySupport: false,
              instantPayouts: false,
            },
            pointsRedeemed: 0,
          },
          verification: {
            status: 'pending',
            documents: new Map(),
            submittedAt: new Date(),
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
            security: { twoFactorAuth: false, loginNotifications: true },
            customSite: { theme: 'default', primaryColor: '#000000' },
          },
          pointsBalance: 50,
          pointsTransactions: [
            {
              amount: 50,
              type: 'earn',
              description: 'مكافأة ترحيبية',
              createdAt: new Date(),
            },
          ],
          freeTrialActive: true,
          freeTrialEndDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          trialMonthsUsed: 0,
          customSiteUrl: `/seller/${user._id.toString()}`,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        { upsert: true }
      );
      console.log(`تم تهيئة بائع للمستخدم: ${user.email}`);
    }

    // تهيئة الإعدادات
    for (const setting of settings) {
      if (!setting.key) continue;
      await Setting.updateOne({ key: setting.key }, setting, { upsert: true });
    }

    // تهيئة الصفحات
    for (const page of webPages) {
      await WebPage.updateOne({ slug: page.slug }, page, { upsert: true });
    }

    // تهيئة المنتجات
    for (const product of products) {
      const { _id, ...rest } = product;
      await Product.updateOne({ slug: product.slug }, rest, { upsert: true });
    }

    // تهيئة المراجعات
    const allProducts = await Product.find({});
    for (let i = 0; i < allProducts.length; i++) {
      let x = 0;
      const { ratingDistribution } = allProducts[i];
      for (let j = 0; j < ratingDistribution.length; j++) {
        for (let k = 0; k < ratingDistribution[j].count; k++) {
          x++;
          const review = {
            ...reviews.filter((r) => r.rating === j + 1)[
              x % reviews.filter((r) => r.rating === j + 1).length
            ],
            isVerifiedPurchase: true,
            product: allProducts[i]._id,
            user: allUsers[x % allUsers.length]._id,
            updatedAt: Date.now(),
            createdAt: Date.now(),
          };
          await Review.updateOne(
            {
              product: review.product,
              user: review.user,
              rating: review.rating,
            },
            review,
            { upsert: true }
          );
        }
      }
    }

    // تهيئة الطلبات
    for (let i = 0; i < 200; i++) {
      const order = await generateOrder(
        i,
        allUsers.map((u) => u._id),
        allProducts.map((p) => p._id)
      );
      await Order.updateOne(
        { user: order.user, createdAt: order.createdAt },
        order,
        { upsert: true }
      );
    }

    console.log('✅ تم تحديث قاعدة البيانات بنجاح بدون حذف أي بيانات');
    process.exit(0);
  } catch (error) {
    console.error('❌ خطأ أثناء تحديث قاعدة البيانات:', error);
    process.exit(1);
  }
};

const generateOrder = async (
  i: number,
  users: any[],
  products: any[]
): Promise<IOrderInput> => {
  const p1 = await Product.findById(products[i % products.length]);
  const p2 = await Product.findById(products[(i + 1) % products.length]);
  const p3 = await Product.findById(products[(i + 2) % products.length]);

  if (!p1 || !p2 || !p3) throw new Error('المنتج غير موجود');

  const items = [p1, p2, p3].map((p, idx) => ({
    clientId: generateId(),
    product: p._id,
    name: p.name,
    slug: p.slug,
    quantity: idx + 1,
    image: p.images[0],
    category: p.category,
    price: p.price,
    countInStock: p.countInStock,
  }));

  const user = users[i % users.length];
  const baseUser = data.users[i % data.users.length];
  const defaultAddress = {
    street: '123 Main St',
    city: 'Sample City',
    province: 'Sample State',
    country: 'Sample Country',
    postalCode: '12345',
    phone: '+1234567890',
  };

  return {
    user,
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

export const calcDeliveryDateAndPriceForSeed = ({
  items,
  deliveryDateIndex,
}: {
  deliveryDateIndex?: number;
  items: OrderItem[];
  shippingAddress?: ShippingAddress;
}) => {
  const { availableDeliveryDates } = data.settings[0];
  const itemsPrice = round2(
    items.reduce((acc, item) => acc + item.price * item.quantity, 0)
  );

  const deliveryDate =
    availableDeliveryDates[
      deliveryDateIndex ?? availableDeliveryDates.length - 1
    ];

  const shippingPrice = deliveryDate.shippingPrice;
  const taxPrice = round2(itemsPrice * 0.15);
  const totalPrice = round2(itemsPrice + shippingPrice + taxPrice);

  return {
    availableDeliveryDates,
    deliveryDateIndex: deliveryDateIndex ?? availableDeliveryDates.length - 1,
    itemsPrice,
    shippingPrice,
    taxPrice,
    totalPrice,
  };
};

main();