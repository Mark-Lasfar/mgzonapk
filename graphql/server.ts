import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { readFileSync } from 'fs';
import { join } from 'path';
import { resolvers } from './resolvers';
import { auth } from '@/auth';
import type { Session } from 'next-auth';
import type { IncomingMessage } from 'http';
import crypto from 'crypto';

// دالة مساعدة لتسجيل الـ logs عبر API
async function logToApi(type: 'info' | 'error', message: string, meta: any, error?: string) {
  try {
    await fetch('/api/log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type,
        message,
        error,
        meta,
      }),
    });
  } catch (err) {
    console.error('Failed to send log to /api/log:', err);
  }
}

// اقرأ السكيمات من ملف GraphQL
const typeDefs = readFileSync(join(process.cwd(), 'graphql/schema.graphql'), { encoding: 'utf-8' });

// أنشئ السيرفر
const server = new ApolloServer<{ session: Session | null }>({
  typeDefs,
  resolvers,
});

// شغل السيرفر مع context
const { url } = await startStandaloneServer(server, {
  listen: { port: 4000 },
  context: async ({ req }: { req: IncomingMessage }) => {
    const requestId = crypto.randomUUID();
    try {
      // استخدم auth() بدون تمرير req، واعتمد على الـ cookies/headers في الطلب
      const session = await auth();
      await logToApi('info', 'Session retrieved for GraphQL request', {
        requestId,
        userId: session?.user?.id,
        headers: req.headers, // Log headers for debugging
      });
      return { session };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to retrieve session';
      await logToApi('error', 'Error retrieving session for GraphQL request', {
        requestId,
        headers: req.headers, // Log headers for debugging
      }, errorMessage);
      return { session: null }; // Return null session instead of throwing
    }
  },
});

await logToApi('info', `Server started at ${url}`, { port: 4000 });

console.log(`🚀 Server ready at ${url}`);