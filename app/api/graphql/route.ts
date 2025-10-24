// app/api/graphql/route.ts

import { ApolloServer, HeaderMap } from '@apollo/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import { resolvers } from '@/graphql/resolvers';
import { auth } from '@/auth';

// قراءة سكيمه GraphQL
const typeDefs = readFileSync(
  join(process.cwd(), 'graphql/schema.graphql'),
  { encoding: 'utf-8' }
);

// إنشاء السيرفر
const server = new ApolloServer({
  typeDefs,
  resolvers,
});

// وظيفة مساعده لتحويل Web Headers إلى Apollo HeaderMap
function createHeaderMap(reqHeaders: Headers): HeaderMap {
  const headerMap = new HeaderMap();
  for (const [key, value] of reqHeaders.entries()) {
    headerMap.set(key, value);
  }
  return headerMap;
}

// -----------------------------
// GET handler
// -----------------------------
export async function GET(req: Request) {
  const context = await auth();
  const response = await server.executeHTTPGraphQLRequest({
    httpGraphQLRequest: {
      method: 'GET',
      headers: createHeaderMap(req.headers),
      body: null,
      search: new URL(req.url).search,
    },
    context: async () => ({ session: context }),
  });

  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });

  let body = '';
  if (response.body.kind === 'complete') {
    body = response.body.string;
  } else {
    for await (const chunk of response.body.asyncIterator) {
      body += chunk;
    }
  }

  return new Response(body, {
    status: response.status || 200,
    headers,
  });
}

// -----------------------------
// POST handler
// -----------------------------
export async function POST(req: Request) {
  const context = await auth();
  const bodyText = await req.text();

  const response = await server.executeHTTPGraphQLRequest({
    httpGraphQLRequest: {
      method: 'POST',
      headers: createHeaderMap(req.headers),
      body: bodyText ? JSON.parse(bodyText) : {},
      search: new URL(req.url).search,
    },
    context: async () => ({ session: context }),
  });

  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });

  let body = '';
  if (response.body.kind === 'complete') {
    body = response.body.string;
  } else {
    for await (const chunk of response.body.asyncIterator) {
      body += chunk;
    }
  }

  return new Response(body, {
    status: response.status || 200,
    headers,
  });
}
