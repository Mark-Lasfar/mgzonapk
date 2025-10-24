import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectToDatabase } from '@/lib/db';
import Client from '@/lib/db/models/client.model';
import { customLogger } from '@/lib/api/services/logging';
import { getTranslations } from 'next-intl/server';
import crypto from 'crypto';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const requestId = crypto.randomUUID();
  const t = await getTranslations('api.admin.clients');
  try {
    await connectToDatabase();
    const session = await auth();
    if (!session?.user?.id || session.user.role !== 'Admin') {
      await customLogger.error('Unauthorized access to client review', { requestId, service: 'api' });
      return NextResponse.json(
        { success: false, error: t('unauthorized'), requestId, timestamp: new Date().toISOString() },
        { status: 401 }
      );
    }

    const { status, commissionRate } = await req.json();
    if (!['approved', 'rejected'].includes(status)) {
      return NextResponse.json(
        { success: false, error: t('invalid_status'), requestId, timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    const client = await Client.findById(params.id);
    if (!client) {
      return NextResponse.json(
        { success: false, error: t('client_not_found'), requestId, timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    client.status = status;
    if (status === 'approved' && commissionRate !== undefined) {
      client.commissionRate = commissionRate;
      client.isActive = true;
    } else if (status === 'rejected') {
      client.isActive = false;
    }
    client.updatedBy = session.user.id;
    await client.save();

    await customLogger.info('Client reviewed successfully', {
      requestId,
      clientId: client.clientId,
      status,
      commissionRate,
      service: 'api',
    });

    return NextResponse.json({
      success: true,
      data: {
        clientId: client.clientId,
        name: client.name,
        status: client.status,
        commissionRate: client.commissionRate,
      },
      requestId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : t('unknown_error');
    await customLogger.error('Failed to review client', { requestId, error: errorMessage, service: 'api' });
    return NextResponse.json(
      { success: false, error: errorMessage, requestId, timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}