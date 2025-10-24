// lib/actions/support.actions.ts
import { z } from 'zod';
import { connectToDatabase } from '@/lib/db';
import SupportTicket, { ISupportTicket } from '@/lib/db/models/support-ticket.model';

const ticketSchema = z.object({
  subject: z.string().min(5),
  description: z.string().min(20),
  category: z.string(),
  orderId: z.string().optional(),
});

type TicketInput = z.infer<typeof ticketSchema>;

/**
 * إنشاء تذكرة دعم جديدة
 */
export async function createTicket(data: TicketInput & { userId: string }) {
  try {
    await connectToDatabase();
    ticketSchema.parse(data);

    const newTicket = await SupportTicket.create({
      userId: data.userId,
      orderId: data.orderId || undefined,
      subject: data.subject,
      description: data.description,
      category: data.category,
    });

    return { success: true, ticketId: newTicket._id.toString() };
  } catch (error: any) {
    console.error('[createTicket]', error);
    return { success: false, error: error.message || 'Failed to create ticket' };
  }
}

/**
 * جلب التذاكر لمستخدم معين مع إمكانية التصفية والتقسيم إلى صفحات
 */
export async function getTickets(
  userId: string,
  options: { page?: number; status?: string }
): Promise<{
  data: { tickets: any[]; totalPages: number };
}> {
  try {
    await connectToDatabase();

    const page = options.page || 1;
    const pageSize = 10;

    const filter: Record<string, any> = { userId };

    if (options.status) {
      filter.status = options.status;
    }

    const totalTickets = await SupportTicket.countDocuments(filter);
    const totalPages = Math.ceil(totalTickets / pageSize);

    const tickets = await SupportTicket.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean();

    // تحويل _id إلى string وتنظيف البيانات
    const cleanedTickets = tickets.map((ticket: any) => ({
      _id: ticket._id.toString(),
      subject: ticket.subject,
      status: ticket.status,
      category: ticket.category,
      priority: ticket.priority,
      createdAt: ticket.createdAt,
    }));

    return {
      data: {
        tickets: cleanedTickets,
        totalPages,
      },
    };
  } catch (error: any) {
    console.error('[getTickets]', error);
    return {
      data: {
        tickets: [],
        totalPages: 0,
      },
    };
  }
}