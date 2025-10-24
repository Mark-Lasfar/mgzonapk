import { Metadata } from 'next';
import PortfolioManagementPageClient from './PortfolioManagementPageClient';

export const metadata: Metadata = {
  title: 'Portfolio Management',
  description:
    'Manage your portfolio projects, skills, comments, GitHub repos, notifications, profile picture, education, contact info, resume export, AI chat, and user search',
};

export default async function PortfolioManagementPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  return <PortfolioManagementPageClient locale={locale} />;
}