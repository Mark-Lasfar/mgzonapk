import { Metadata } from 'next';
import AdminTicketList from './ticket-list';

export const metadata: Metadata = {
  title: 'Admin Tickets',
};

export default function AdminTicketsPage() {
  return <AdminTicketList />;
}
