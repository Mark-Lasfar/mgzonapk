import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { MongoClient, ServerApiVersion } from 'mongodb';
import { customLogger } from '@/lib/api/services/logging';

// تحميل المتغيرات البيئية من .env.local
dotenv.config({ path: '/home/mark/Music/my-nextjs-project-clean/.env.local' });

let mongooseConn: typeof mongoose | null = null;
let mongoClient: MongoClient | null = null;

export async function connectMongoose(mode: 'sandbox' | 'live' = 'live'): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) {
    customLogger.info('Already connected to MongoDB via Mongoose', { service: 'db', mode });
    return mongoose;
  }

  try {
    const uri = mode === 'sandbox' ? process.env.MONGODB_URI_SANDBOX : process.env.MONGODB_URI;
    if (!uri) {
      throw new Error(`MONGODB_URI${mode === 'sandbox' ? '_SANDBOX' : ''} not found`);
    }

    mongooseConn = await mongoose.connect(uri, {
      dbName: mode === 'sandbox' ? 'mgzon_sandbox' : 'mgzon',
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
    });

    customLogger.info('Connected to MongoDB via Mongoose', { service: 'db', mode });
    return mongooseConn;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown Mongoose connection error';
    customLogger.error('Failed to connect to MongoDB via Mongoose', { service: 'db', mode, error: errorMessage });
    throw new Error(errorMessage);
  }
}

export async function getMongoClient(mode: 'sandbox' | 'live' = 'live'): Promise<MongoClient> {
  if (mongoClient && mongoClient.topology?.isConnected()) {
    customLogger.info('Reusing existing MongoClient connection', { service: 'db', mode });
    return mongoClient;
  }

  try {
    const uri = mode === 'sandbox' ? process.env.MONGODB_URI_SANDBOX : process.env.MONGODB_URI;
    if (!uri) {
      throw new Error(`MONGODB_URI${mode === 'sandbox' ? '_SANDBOX' : ''} not found`);
    }

    mongoClient = new MongoClient(uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
      maxPoolSize: 10,
    });

    await mongoClient.connect();
    customLogger.info('Connected to MongoDB via MongoClient', { service: 'db', mode });
    return mongoClient;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown MongoClient connection error';
    customLogger.error('Failed to connect to MongoDB via MongoClient', { service: 'db', mode, error: errorMessage });
    throw new Error(errorMessage);
  }
}

export async function connectToDatabase(mode: 'sandbox' | 'live' = 'live'): Promise<{ mongoose: typeof mongoose; client: MongoClient }> {
  try {
    const mongooseConnection = await connectMongoose(mode);
    const mongoClientConnection = await getMongoClient(mode);
    return { mongoose: mongooseConnection, client: mongoClientConnection };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown database connection error';
    customLogger.error('Failed to connect to database', { service: 'db', mode, error: errorMessage });
    throw new Error(errorMessage);
  }
}

export async function disconnectFromDatabase(): Promise<void> {
  try {
    if (mongooseConn && mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      mongooseConn = null;
      customLogger.info('Disconnected from MongoDB via Mongoose', { service: 'db' });
    }
    if (mongoClient && mongoClient.topology?.isConnected()) {
      await mongoClient.close();
      mongoClient = null;
      customLogger.info('Disconnected from MongoDB via MongoClient', { service: 'db' });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown database disconnection error';
    customLogger.error('Failed to disconnect from MongoDB', { service: 'db', error: errorMessage });
    throw new Error(errorMessage);
  }
}