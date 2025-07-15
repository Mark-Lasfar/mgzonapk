import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { auth } from '@/auth';
import Integration, { IIntegration } from '@/lib/db/models/integration.model';
import { logger } from '@/lib/api/services/logging';
import { randomUUID } from 'crypto';
import { z } from 'zod';

const updateSchema = z.object({
  integrationId: z.string().min(1, 'Integration ID is required'),
  isActive: z.boolean().optional(),
  sandbox: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
  const requestId = randomUUID();
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== 'Admin') {
      logger.warn('Unauthorized access attempt', { requestId });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = await updateSchema.parseAsync(body);
    const { searchParams } = new URL(req.url);
    const sandbox = searchParams.get('sandbox') === 'true';

    await connectToDatabase(sandbox ? 'sandbox' : 'live');

    const updateFields: Partial<Pick<IIntegration, 'isActive' | 'sandbox'>> = {};
    if (validatedData.isActive !== undefined) updateFields.isActive = validatedData.isActive;
    if (validatedData.sandbox !== undefined) updateFields.sandbox = validatedData.sandbox;

    const integration = await Integration.findByIdAndUpdate(
      validatedData.integrationId,
      updateFields,
      { new: true }
    );

    if (!integration) {
      logger.warn('Integration not found', { requestId, integrationId: validatedData.integrationId });
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    logger.info('Integration settings updated', { requestId, integrationId: integration._id, sandbox });
    return NextResponse.json({ success: true, data: integration });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to update integration settings', { requestId, error: errorMessage, sandbox });
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}