'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { format } from 'date-fns';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function AdminTicketList() {
  const { data: tickets, error } = useSWR('/api/v1/support/tickets', fetcher);

  if (error) return <div className="p-4 text-red-500">حدث خطأ أثناء تحميل التذاكر</div>;
  if (!tickets) return <div className="p-4">جاري التحميل...</div>;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold mb-4">قائمة التذاكر</h2>
      <table className="w-full border">
        <thead>
          <tr className="bg-gray-100 text-left">
            <th className="p-2">الموضوع</th>
            <th className="p-2">البريد الإلكتروني</th>
            <th className="p-2">الأولوية</th>
            <th className="p-2">الحالة</th>
            <th className="p-2">التاريخ</th>
            <th className="p-2">تفاصيل</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket: any) => (
            <tr key={ticket._id} className="border-t">
              <td className="p-2">{ticket.subject}</td>
              <td className="p-2">{ticket.userId}</td>
              <td className="p-2">{ticket.priority}</td>
              <td className="p-2">{ticket.status}</td>
              <td className="p-2">{format(new Date(ticket.createdAt), 'yyyy-MM-dd HH:mm')}</td>
              <td className="p-2">
                <Link
                  className="text-blue-500 hover:underline"
                  href={`/admin/tickets/${ticket._id}`}
                >
                  عرض
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
