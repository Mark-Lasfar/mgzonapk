'use server';

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import Product from '@/lib/db/models/product.model';
import Review from '@/lib/db/models/review.model'; // افترض إن عندك موديل Review
import { sendNotification } from '@/lib/utils/notification';
import { useTranslations } from 'next-intl';

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json();
    const { productId, userId, userName, rating, comment, sendNotification } = body;

    // أنشئ الـ Review
    const review = await Review.create({
      productId,
      userId,
      userName,
      rating,
      comment,
      createdAt: new Date(),
    });

    // تحديث متوسط التقييم في المنتج
    const product = await Product.findById(productId);
    if (!product) {
      return NextResponse.json({ success: false, message: 'Product not found' }, { status: 404 });
    }

    // افترض إن عندك حقل reviews في الـ Product
    product.reviews = product.reviews || [];
    product.reviews.push(review._id);
    await product.save();

    // إرسال إشعار للبائع إذا طلب
    if (sendNotification) {
      const t = useTranslations('product.reviews'); // محتاج تحدد الـ locale هنا، أو تستخدم طريقة تانية
      const seller = await Product.findById(productId).select('sellerId name').lean();
      if (seller?.sellerId) {
        await sendNotification({
          userId: seller.sellerId.toString(),
          type: 'product_reviewed',
          title: t('NewProductReview'),
          message: t('ProductReviewMessage', {
            productName: seller.name,
            rating,
            comment,
          }),
          channels: ['email', 'in_app', 'whatsapp'],
          data: { productId, rating, comment },
        });
      }
    }

    return NextResponse.json({ success: true, review });
  } catch (error) {
    console.error('Review API error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Failed to submit review' },
      { status: 500 }
    );
  }
}