import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import SupportTicket from '@/lib/db/models/support-ticket.model';
import { adminFirestore } from '@/lib/firebase/admin';
import { metricsService } from '@/lib/api/services/metrics';

export async function GET() {
  try {
    await connectToDatabase();
    const tickets = await SupportTicket.find().sort({ createdAt: -1 }).lean();
    return NextResponse.json(tickets);
  } catch (error) {
    console.error('Error fetching tickets:', error);
    return NextResponse.json({ error: 'Failed to fetch tickets' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const data = await request.json();
    const {
      name,
      email,
      subject,
      message,
      category = 'general',
      priority = 'medium',
    } = data;

    if (!name || !email || !subject || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // إنشاء تذكرة جديدة في MongoDB
    const ticket = await SupportTicket.create({
      userId: email, // الآن يقبل string
      subject,
      description: message,
      category,
      priority,
      status: 'open',
      messages: [
        {
          sender: email, // أيضًا string
          message,
          attachments: [],
          createdAt: new Date(),
        },
      ],
    });

    // حفظ نسخة في Firestore (اختياري / لغايات توافقية)
    await adminFirestore.collection('tickets').doc(ticket._id.toString()).set({
      name,
      email,
      subject,
      message,
      category,
      priority,
      status: 'open',
      createdAt: new Date(),
      updatedAt: new Date(),
      comments: [],
    });

    // تسجيل ميتريك
    await metricsService.saveMetric({
      type: 'SUPPORT',
      value: 1,
      metadata: {
        ticketId: ticket._id.toString(),
        category,
      },
    });

    return NextResponse.json({ id: ticket._id }, { status: 201 });
  } catch (error) {
    console.error('Error creating ticket:', error);
    return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 });
  }
}
