// /app/api/v1/support/tickets/route.ts

import { NextResponse } from 'next/server';
import { adminFirestore } from '@/lib/firebase/admin';
import { metricsService } from '@/lib/api/services/metrics';
import { MetricType } from '@/types/metrics';

export async function GET() {
  try {
    const snapshot = await adminFirestore
      .collection('tickets')
      .orderBy('createdAt', 'desc')
      .get();

    const tickets = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json(tickets);
  } catch (error) {
    console.error('Error fetching tickets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tickets' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    const ticket = await adminFirestore.collection('tickets').add({
      ...data,
      status: 'open',
      createdAt: new Date(),
      updatedAt: new Date(),
      comments: []
    });

    // Track metric
    await metricsService.saveMetric({
      type: MetricType.SUPPORT,
      value: 1,
      metadata: {
        ticketId: ticket.id,
        category: data.category
      }
    });

    return NextResponse.json({ id: ticket.id });
  } catch (error) {
    console.error('Error creating ticket:', error);
    return NextResponse.json(
      { error: 'Failed to create ticket' },
      { status: 500 }
    );
  }
}
