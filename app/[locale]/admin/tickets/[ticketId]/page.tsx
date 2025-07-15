import { connectToDatabase } from '@/lib/db';
import SupportTicket from '@/lib/db/models/support-ticket.model';
import { notFound } from 'next/navigation';

interface Props {
  params: { ticketId: string };
}

export default async function AdminTicketDetailPage({ params }: Props) {
await connectToDatabase();
  const ticket = await SupportTicket.findById(params.ticketId).lean();

  if (!ticket) {
    notFound();
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">تفاصيل التذكرة</h1>
      <div className="space-y-2">
        <p><strong>الموضوع:</strong> {ticket.subject}</p>
        <p><strong>البريد:</strong> {ticket.userId}</p>
        <p><strong>الوصف:</strong> {ticket.description}</p>
        <p><strong>الحالة:</strong> {ticket.status}</p>
        <p><strong>الأولوية:</strong> {ticket.priority}</p>
        <p><strong>تاريخ الإنشاء:</strong> {new Date(ticket.createdAt).toLocaleString()}</p>
        {ticket.messages?.length > 0 && (
          <>
            <h2 className="text-lg font-semibold mt-4">الرسائل:</h2>
            <ul className="list-disc pl-6">
              {ticket.messages.map((msg: any, index: number) => (
                <li key={index}>
                  <p><strong>{msg.sender}:</strong> {msg.message}</p>
                  <p className="text-sm text-gray-500">{new Date(msg.createdAt).toLocaleString()}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
