import { schedule } from 'node-cron';
import { connectToDatabase } from '@/lib/db';
import Seller from '@/lib/db/models/seller.model';
import { customLogger } from '@/lib/api/services/logging';

// إعادة ضبط عداد الاستخدام كل شهر
schedule('0 0 1 * *', async () => {
  try {
    await connectToDatabase();
    await Seller.updateMany(
      { 'aiAssistant.status': 'free' },
      { $set: { 'aiAssistant.uses': 0 } }
    );
    customLogger.info('AI Assistant uses reset for all free users', { service: 'cron' });
  } catch (error) {
    customLogger.error('Failed to reset AI Assistant uses', { service: 'cron', error: String(error) });
  }
});