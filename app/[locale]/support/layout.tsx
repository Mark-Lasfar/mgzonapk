import { getSetting } from '@/lib/actions/setting.actions';
import Image from 'next/image';
import Link from 'next/link';
import { Chatbote } from '@/components/shared/Chatbote';
import { FooterDoce } from '@/components/shared/footerDoce';
import SupportLayoutClient from './SupportLayoutClient';

export default async function SupportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { site } = await getSetting();

  return <SupportLayoutClient>{children}</SupportLayoutClient>;
}