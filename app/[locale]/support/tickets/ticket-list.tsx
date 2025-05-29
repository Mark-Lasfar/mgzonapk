'use client';

import { DataTable } from '@/components/ui/data-table';
import { useEffect, useState } from 'react';
// import { DataTable } from '@../components/ui/data-table';

export function TicketList() {
  const [tickets, setTickets] = useState([]);

  useEffect(() => {
    fetch('/api/v1/support/tickets')
      .then(res => res.json())
      .then(data => setTickets(data));
  }, []);

  const columns = [
    { accessorKey: 'id', header: 'ID' },
    { accessorKey: 'title', header: 'Title' },
    { accessorKey: 'status', header: 'Status' },
    { accessorKey: 'createdAt', header: 'Created' },
  ];

  return <DataTable columns={columns} data={tickets} searchKey="title" />;
}