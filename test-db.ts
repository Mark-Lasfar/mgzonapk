import dotenv from 'dotenv';
dotenv.config();


import { connectToDatabase } from './lib/db/index';

async function testConnection() {
  try {
    console.log('REDIS_URL:', process.env.UPSTASH_REDIS_URL);
    console.log('REDIS_TOKEN:', process.env.UPSTASH_REDIS_TOKEN);


    console.log('MONGODB_URI:', process.env.MONGODB_URI);
    console.log('Connecting...');
    
    const { mongoose, client } = await connectToDatabase('live');
    
    console.log('Connected to DB:', mongoose.connection.db.databaseName);
    await client.close();
    console.log('MongoClient closed');
  } catch (error) {
    console.error('Connection error:', error);
  }
}

testConnection();
