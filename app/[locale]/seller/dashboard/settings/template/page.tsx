// import { getTranslations } from 'next-intl/server';
// import { auth } from '@/auth';
// import { redirect } from 'next/navigation';
// import { connectToDatabase } from '@/lib/db';
// import Store from '@/lib/db/models/store.model';
// import TemplateSettingsFormWrapper from '@/components/seller/TemplateSettingsFormWrapper';

// async function sendLog(type: 'info' | 'error', message: string, meta?: any) {
//   try {
//     await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/log`, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({ type, message, meta, timestamp: new Date().toISOString() }),
//     });
//   } catch (err) {
//     console.error('Failed to send log:', err);
//   }
// }

// export default async function TemplateSettingsPage({
//   params,
// }: {
//   params: Promise<{ locale: string }>;
// }) {
//   const t = await getTranslations('Template');
//   const { locale } = await params;
//   const session = await auth();

//   if (!session?.user?.storeId) {
//     await sendLog('error', t('errors.unauthorized'), { userId: session?.user?.id });
//     redirect(`/${locale}/sign-in`);
//   }

//   await connectToDatabase();
//   const store = await Store.findOne({ storeId: session.user.storeId }).lean();
//   if (!store) {
//     await sendLog('error', t('errors.storeNotFound'), { userId: session.user.id });
//     return (
//       <div className="container mx-auto px-4 py-8">
//         <h1 className="text-3xl font-bold mb-6">{t('title')}</h1>
//         <p className="text-red-600">{t('errors.storeNotFound')}</p>
//       </div>
//     );
//   }

//   // Fetch template data
//   const templateResponse = await fetch(
//     `${process.env.NEXT_PUBLIC_BASE_URL}/api/stores/${session.user.storeId}/template`,
//     { cache: 'no-store' }
//   );
//   const templateResult = await templateResponse.json();
//   if (!templateResult.success || !templateResult.template) {
//     await sendLog('error', t('errors.fetchError'), { userId: session.user.id });
//     return (
//       <div className="container mx-auto px-4 py-8">
//         <h1 className="text-3xl font-bold mb-6">{t('title')}</h1>
//         <p className="text-red-600">{t('errors.fetchError')}</p>
//       </div>
//     );
//   }

//   const template = templateResult.template;

//   return (
//     <div className="container mx-auto px-4 py-8">
//       <h1 className="text-3xl font-bold mb-6">{t('title')}</h1>
//       <TemplateSettingsFormWrapper defaultValues={template} locale={locale} storeId={session.user.storeId} />
//     </div>
//   );
// }