// app/api/seller/bank/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectToDatabase } from '@/lib/db';
import Seller from '@/lib/db/models/seller.model';
import { decrypt } from '@/lib/utils/encryption';

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthenticated' },
        { status: 401 }
      );
    }

    const seller = await Seller.findOne({ userId: session.user.id }).select('bankInfo');

    if (!seller) {
      return NextResponse.json(
        { success: false, error: 'Seller not found' },
        { status: 404 }
      );
    }

    const bankInfo = seller.bankInfo;
    if (!bankInfo) {
      return NextResponse.json({
        success: true,
        data: {
          accountName: '',
          accountNumber: '',
          bankName: '',
          swiftCode: '',
          isVerified: false,
        },
      });
    }

    // فك تشفير البيانات الحساسة (اختياري - للعرض فقط)
    const decryptedAccountNumber = bankInfo.accountNumber 
      ? await decrypt(bankInfo.accountNumber) 
      : '';
    const decryptedSwiftCode = bankInfo.swiftCode 
      ? await decrypt(bankInfo.swiftCode) 
      : '';

    return NextResponse.json({
      success: true,
      data: {
        accountName: bankInfo.accountName || '',
        accountNumber: decryptedAccountNumber || '',
        bankName: bankInfo.bankName || '',
        swiftCode: decryptedSwiftCode || '',
        isVerified: bankInfo.verified || false,
      },
    });
  } catch (error) {
    console.error('Get bank info error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error' },
      { status: 500 }
    );
  }
}