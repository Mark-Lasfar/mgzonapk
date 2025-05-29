'use client';

import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export default function AuthError() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const error = searchParams.get('error');

  let errorMessage = 'حدث خطأ في المصادقة';
  
  switch (error) {
    case 'CredentialsSignin':
      errorMessage = 'البريد الإلكتروني أو كلمة المرور غير صحيحة';
      break;
    case 'OAuthAccountNotLinked':
      errorMessage = 'البريد الإلكتروني مستخدم بالفعل مع طريقة تسجيل دخول أخرى';
      break;
    case 'OAuthCreateAccount':
      errorMessage = 'حدث خطأ أثناء إنشاء الحساب';
      break;
    default:
      errorMessage = error || 'حدث خطأ غير متوقع';
  }

  return (
    <div className="w-full">
      <div className="rounded-lg bg-red-50 p-8">
        <h1 className="text-2xl font-bold text-red-700 mb-4">
          خطأ في تسجيل الدخول
        </h1>
        <p className="text-red-600 mb-6">{errorMessage}</p>
        <div className="flex gap-4">
          <Button
            onClick={() => router.push('/sign-in')}
            variant="default"
          >
            العودة لتسجيل الدخول
          </Button>
          <Button
            onClick={() => router.push('/')}
            variant="outline"
          >
            الصفحة الرئيسية
          </Button>
        </div>
      </div>
    </div>
  );
}