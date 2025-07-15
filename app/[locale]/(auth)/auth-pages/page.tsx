'use client';

import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

export default function AuthError() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useTranslations('Auth.Errors'); // استخدام namespace للأخطاء
  const error = searchParams.get('error');

  let errorMessage = t('defaultError'); // 'حدث خطأ في المصادقة'

  switch (error) {
    case 'CredentialsSignin':
      errorMessage = t('credentialsSignin'); // 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
      break;
    case 'OAuthAccountNotLinked':
      errorMessage = t('oAuthAccountNotLinked'); // 'البريد الإلكتروني مستخدم بالفعل مع طريقة تسجيل دخول أخرى'
      break;
    case 'OAuthCreateAccount':
      errorMessage = t('oAuthCreateAccount'); // 'حدث خطأ أثناء إنشاء الحساب'
      break;
    default:
      errorMessage = error || t('defaultError'); // 'حدث خطأ غير متوقع'
  }

  return (
    <div className="w-full">
      <div className="rounded-lg bg-red-50 p-8">
        <h1 className="text-2xl font-bold text-red-700 mb-4">
          {t('title')} {/* خطأ في تسجيل الدخول */}
        </h1>
        <p className="text-red-600 mb-6">{errorMessage}</p>
        <div className="flex gap-4">
          <Button
            onClick={() => router.push('/sign-in')}
            variant="default"
          >
            {t('backToSignIn')} {/* العودة لتسجيل الدخول */}
          </Button>
          <Button
            onClick={() => router.push('/')}
            variant="outline"
          >
            {t('homePage')} {/* الصفحة الرئيسية */}
          </Button>
        </div>
      </div>
    </div>
  );
}