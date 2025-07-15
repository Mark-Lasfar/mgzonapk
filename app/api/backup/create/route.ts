import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { auth } from '@/auth';
import { MongoClient } from 'mongodb';
import { logger } from '@/lib/api/services/logging';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promisify';
import { encrypt, encryptStream } from '@/lib/utils/encryption';
import { Readable } from 'stream';

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== 'Admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { incremental = false, collections: selectedCollections } = await req.json();
    await connectToDatabase();

    const client = new MongoClient(process.env.MONGODB_URI!);
    await client.connect();
    const db = client.db();

    const collections = (await db.listCollections().toArray())
      .map(c => c.name)
      .filter(c => !selectedCollections || selectedCollections.includes(c));

    const backupData: Record<string, any[]> = {};
    let lastBackupTime: Date | undefined;

    if (incremental) {
      const lastBackup = await db.collection('backups').findOne({}, { sort: { createdAt: -1 } });
      lastBackupTime = lastBackup?.createdAt;
    }

    for (const collection of collections) {
      const query = lastBackupTime ? { updatedAt: { $gt: lastBackupTime } } : {};
      const data = await db.collection(collection).find(query).toArray();
      backupData[collection] = data;
    }

    const backupFileName = `backup-${incremental ? 'incremental' : 'full'}-${new Date().toISOString()}.json.gz.enc`;
    const backupStream = Readable.from(JSON.stringify(backupData));
    const gzipStream = createGzip();
    const encrypt = encrypt(process.env.BACKUP_ENCRYPTION_KEY!);

    const uploadStream = await s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET!,
        Key: backupFileName,
        Body: backupStream.pipe(gzipStream).pipe(encrypt),
        ContentType: 'application/octet-stream',
      })
    );

    // Store backup metadata
    await db.collection('backups').insertOne({
      fileName: backupFileName,
      collections,
      incremental,
      createdAt: new Date(),
      createdBy: session.user.id,
    });

    await client.close();

    logger.info('Backup created', { requestId, backupFileName, incremental });
    return NextResponse.json({ success: true, fileName: backupFileName });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to create backup', { requestId, error: errorMessage });
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}