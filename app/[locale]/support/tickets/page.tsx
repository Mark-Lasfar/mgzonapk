import { Metadata } from 'next';
import { auth } from '@/auth';
import { TicketList } from './ticket-list';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Support Tickets',
};

export default async function SupportTickets({
  searchParams,
}: {
  searchParams: { page?: string; status?: string };
}) {
  const session = await auth();
  const page = Number(searchParams.page) || 1;
  const statusFilter = searchParams.status;

  let tickets: any[] = [];
  let totalPages = 0;

  try {
    const query = new URLSearchParams();
    if (page > 1) query.set('page', page.toString());
    if (statusFilter) query.set('status', statusFilter);
    if (session?.user?.id) query.set('userId', session.user.id);

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/v1/support/tickets?${query.toString()}`,
      { cache: 'no-store' }
    );

    if (res.ok) {
      const data = await res.json();
      tickets = Array.isArray(data) ? data : [];
      totalPages = 1; // لو مفيش pagination في الـ API
    }
  } catch (error) {
    console.error('Failed to fetch tickets:', error);
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Support Tickets</h1>
      </div>
      <TicketList initialTickets={tickets} />
    </div>
  );
}