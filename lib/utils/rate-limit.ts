import { connectToDatabase } from '@/lib/db';
import VerificationCode from '@/lib/db/models/verification-code.model';

export async function rateLimit(
  req: Request,
  options: { max: number; windowMs: number; key: string }
) {
  const { max, windowMs, key } = options;
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const identifier = `${key}:${ip}`;

  await connectToDatabase();

  const now = new Date();
  const windowStart = new Date(now.getTime() - windowMs);

  const requestCount = await VerificationCode.countDocuments({
    email: identifier,
    createdAt: { $gte: windowStart },
  });

  if (requestCount >= max) {
    return { success: false, reset: windowStart.getTime() + windowMs };
  }

  return { success: true, reset: null };
}