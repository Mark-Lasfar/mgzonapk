// app/api/v1/admin/tickets/route.ts
import { NextResponse } from 'next/server';
// import connectToDatabase from '@/lib/db/';
// import SupportTicket from '@/models/SupportTicket';
import { connectToDatabase } from '@/lib/db';
import SupportTicket from '@/lib/db/models/support-ticket.model';

export async function GET() {
  try {
    await connectToDatabase();
    const tickets = await SupportTicket.find().sort({ createdAt: -1 });
    return NextResponse.json({ tickets });
  } catch (error) {
    console.error('Failed to fetch tickets:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
