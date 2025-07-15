// import { Resend } from '@resend/emails';
import Integration from '@/lib/db/models/integration.model';
import { connectToDatabase } from '@/lib/db';
import { Resend } from 'resend';

export async function sendTicketNotification({
  to,
  subject,
  message,
  userId,
}: {
  to: string;
  subject: string;
  message: string;
  userId: string;
}) {
  await connectToDatabase();

  // جلب تكاملات الإيميل الخاصة بالبائع
  const emailIntegration = await Integration.findOne({
    createdBy: userId,
    type: 'communication',
    isActive: true,
    category: 'communication',
  });

  if (!emailIntegration) {
    throw new Error('No active email integration found for this seller');
  }

  let provider;
  let emailConfig;

  // بناءً على اسم المزود (providerName) في التكامل
  switch (emailIntegration.providerName.toLowerCase()) {
    case 'resend':
      provider = new Resend(emailIntegration.credentials.get('apiKey'));
      emailConfig = {
        from: `Support <${emailIntegration.credentials.get('fromEmail')}>`,
        to,
        subject: `New Support Ticket: ${subject}`,
        text: message,
      };
      break;
    // أضف مزودين آخرين زي Postmark أو AWS SES لو موجودين
    default:
      throw new Error(`Unsupported email provider: ${emailIntegration.providerName}`);
  }

  try {
    const { data, error } = await provider.emails.send(emailConfig);

    if (error) {
      console.error(`Email provider (${emailIntegration.providerName}) error:`, error);
      throw new Error('Failed to send email');
    }

    return { success: true, data };
  } catch (err) {
    console.error('Send email error:', err);
    throw err;
  }
}