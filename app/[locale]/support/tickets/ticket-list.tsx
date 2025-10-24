'use client';

import { useTranslations } from 'next-intl';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

interface Ticket {
  _id: string;
  subject: string;
  status: string;
  category: string;
  priority: string;
  createdAt: string;
}

export function TicketList({ initialTickets = [] }: { initialTickets?: Ticket[] }) {
  const t = useTranslations('tickets'); // <-- صحيح

  const columns = [
    {
      accessorKey: 'subject',
      header: t('columns.title'),
      cell: ({ row }: { row: { original: Ticket } }) => {
        const ticket = row.original;
        return (
          <Link href={`/support/tickets/${ticket._id}`} className="font-medium hover:underline">
            {ticket.subject}
          </Link>
        );
      },
    },
    {
      accessorKey: 'category',
      header: t('columns.category'),
    },
    {
      accessorKey: 'status',
      header: t('columns.status'),
      cell: ({ row }: { row: { original: Ticket } }) => {
        const status = row.original.status;
        const colors: Record<string, string> = {
          open: 'bg-yellow-100 text-yellow-800',
          in_progress: 'bg-blue-100 text-blue-800',
          resolved: 'bg-green-100 text-green-800',
          closed: 'bg-gray-100 text-gray-800',
        };
        return (
          <Badge className={colors[status] || 'bg-gray-100'}>
            {t(`status.${status}`) || status.replace('_', ' ')}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'priority',
      header: t('columns.priority'),
      cell: ({ row }: { row: { original: Ticket } }) => {
        const priority = row.original.priority;
        const colors: Record<string, string> = {
          high: 'bg-red-100 text-red-800',
          medium: 'bg-orange-100 text-orange-800',
          low: 'bg-gray-100 text-gray-800',
        };
        return (
          <Badge className={colors[priority] || 'bg-gray-100'}>
            {t(`priority.${priority}`) || priority}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'createdAt',
      header: t('columns.created'),
      cell: ({ row }: { row: { original: Ticket } }) => {
        const date = new Date(row.original.createdAt);
        return <span>{format(date, 'MMM d, yyyy')}</span>;
      },
    },
  ];

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button asChild>
          <Link href="/support/tickets/create">{t('createButton')}</Link>
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={initialTickets}
        searchKey="subject"
        searchPlaceholder={t('searchPlaceholder')}
        emptyMessage={t('noTickets')}
      />
    </div>
  );
}