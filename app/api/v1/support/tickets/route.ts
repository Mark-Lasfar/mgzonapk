// app/api/v1/support/tickets/route.ts
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import SupportTicket from '@/lib/db/models/support-ticket.model';
import { adminFirestore } from '@/lib/firebase/admin';
import { metricsService } from '@/lib/api/services/metrics';

// GET: جلب التذاكر بناءً على userId
export async function GET(request: Request) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const status = searchParams.get('status');

    const filter: any = {};
    if (userId) filter.userId = userId;
    if (status) filter.status = status;

    const tickets = await SupportTicket.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    const cleaned = tickets.map((t: any) => ({
      _id: t._id.toString(),
      subject: t.subject,
      status: t.status || 'open',
      category: t.category || 'Other',
      priority: t.priority || 'medium',
      createdAt: t.createdAt,
    }));

    return NextResponse.json(cleaned);
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
      description,
      category = 'Other',
      priority = 'medium',
      orderId,
      integrationId,
      vendorId,
      role = 'user',
      userId,
    } = data;

    if (!name || !email || !subject || !description) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const finalUserId = userId || email;

    const ticket = await SupportTicket.create({
      userId: finalUserId,
      email,
      role,
      orderId: orderId || null,
      integrationId: integrationId || null,
      vendorId: vendorId || null,
      subject,
      description,
      category,
      priority,
      status: 'open',
      messages: [
        {
          sender: email,
          message: description,
          attachments: [],
          createdAt: new Date(),
        },
      ],
    });

    // Firestore sync
    try {
      await adminFirestore.collection('tickets').doc(ticket._id.toString()).set({
        name,
        email,
        subject,
        description,
        category,
        priority,
        status: 'open',
        role,
        orderId,
        integrationId,
        vendorId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } catch (e) {
      console.warn('Firestore sync failed:', e);
    }

    // Metrics
    try {
      await metricsService.saveMetric({
        type: 'SUPPORT',
        value: 1,
        metadata: { ticketId: ticket._id.toString(), category, role },
      });
    } catch (e) {
      console.warn('Metric save failed:', e);
    }

    return NextResponse.json({ id: ticket._id.toString() }, { status: 201 });
  } catch (error) {
    console.error('Error creating ticket:', error);
    return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 });
  }
}