// /app/api/stores/[storeId]/messages/[messageId]/reply/route.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { auth } from '@/auth';
import { connectToDatabase } from '@/lib/db';
import Message from '@/lib/db/models/message.model';
import Integration from '@/lib/db/models/integration.model';
import nodemailer from 'nodemailer';
import { getTranslations } from 'next-intl/server';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const t = await getTranslations('messages');
  const { storeId, messageId } = req.query;
  const session = await auth();

  if (!session?.user?.storeId || session.user.storeId !== storeId) {
    return res.status(401).json({ error: t('unauthorized') });
  }

  try {
    const { reply } = req.body;
    await connectToDatabase();

    const message = await Message.findOne({ _id: messageId, storeId });
    if (!message) {
      return res.status(404).json({ error: t('messageNotFound') });
    }

    message.reply = reply;
    message.status = 'replied';
    await message.save();

    // جلب تكامل البريد الإلكتروني
    const integration = await Integration.findOne({ storeId, type: 'communication', providerName: 'gmail' });
    if (!integration) {
      return res.status(400).json({ error: t('noEmailIntegration') });
    }

    // إذا كان OAuth مفعّل
    if (integration.oauth.enabled && integration.accessToken) {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: integration.credentials.get('emailUser'),
          accessToken: integration.accessToken,
          clientId: integration.settings.clientId,
          clientSecret: integration.settings.clientSecret,
          refreshToken: integration.credentials.get('refreshToken'),
        },
      });

      await transporter.sendMail({
        from: `"${session.user.storeName}" <${integration.credentials.get('emailUser')}>`,
        to: message.senderEmail,
        subject: t('replySubject'),
        text: t('replyBody', { senderName: message.senderName, reply, storeName: session.user.storeName }),
      });
    } else {
      // الطريقة التقليدية باستخدام emailUser وemailPass
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: integration.credentials.get('emailUser'),
          pass: integration.credentials.get('emailPass'),
        },
      });

      await transporter.sendMail({
        from: `"${session.user.storeName}" <${integration.credentials.get('emailUser')}>`,
        to: message.senderEmail,
        subject: t('replySubject'),
        text: t('replyBody', { senderName: message.senderName, reply, storeName: session.user.storeName }),
      });
    }

    return res.json({ success: true, data: message });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : t('serverError') });
  }
}