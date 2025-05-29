// /lib/actions/visit.actions.ts
'use server';

import { connectToDatabase } from '@/lib/db';
import Visit from '@/lib/db/models/visit.model';
import Seller from '@/lib/db/models/seller.model';
import { awardSellerPoints } from './seller.actions'; // Assume this exists

export async function recordVisit(
  visitorId: string,
  sellerId: string,
  referrer?: string,
  ipAddress?: string,
  userAgent?: string
) {
  try {
    await connectToDatabase();

    const visit = new Visit({
      visitorId,
      sellerId,
      referrer,
      ipAddress,
      userAgent,
    });

    await visit.save();

    // Award points to the referrer if applicable
    if (referrer) {
      // Extract referrer sellerId from referrer URL, assuming it's in the format /[locale]/[customSiteUrl]
      const referrerMatch = referrer.match (/\/([a-z]{2})\/([^\/]+)/);
      if (referrerMatch) {
        const [, locale, customSiteUrl] = referrerMatch;
        const referrerSeller = await Seller.findOne({ customSiteUrl });
        if (referrerSeller && referrerSeller._id.toString() !== sellerId) {
          await awardSellerPoints(referrerSeller._id.toString(), 10, 'Referral visit');
        }
      }
    }

    return { success: true, visitId: visit._id };
  } catch (error) {
    console.error('Record visit error:', error);
    return { success: false, message: 'Failed to record visit' };
  }
}