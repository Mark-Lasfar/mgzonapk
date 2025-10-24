import React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Account - Mgzon',
  description: 'Manage your account settings, orders, and profile information.',
};

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 p-4">
      <div className="max-w-5xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold border-b pb-2">Account</h1>
        {children}
      </div>
    </div>
  );
}
