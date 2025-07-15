import { getTranslations } from 'next-intl/server';
import { getSetting } from '@/lib/actions/setting.actions';
import Image from 'next/image';

export default function LoadingPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <div className="flex justify-center my-4">
        <Image
          src="/icons/logo.svg"
          width={80}
          height={80}
          alt="Site logo"
          className="animate-slow-spin rounded-full"
          style={{ maxWidth: '100%', height: 'auto' }}
        />
      </div>
      <div className="p-6 rounded-lg shadow-md w-1/3 text-center">
        Loading...
      </div>
    </div>
  );
}

