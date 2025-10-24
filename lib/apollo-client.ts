// lib/apollo-client.ts

'use client'; // نضمن إنه يشتغل بس في الكلاينت

import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';

export function createApolloClient(token?: string) {
  const httpLink = new HttpLink({
    uri: '/api/graphql', // لا تستخدم process.env هنا إطلاقًا
  });

  const authLink = setContext((_, { headers }) => ({
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    },
  }));

  return new ApolloClient({
    link: authLink.concat(httpLink),
    cache: new InMemoryCache(),
  });
}
