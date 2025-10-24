// /home/mark/Music/my-nextjs-project-clean/auth.ts

import { MongoDBAdapter } from '@auth/mongodb-adapter';
import Google from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import CredentialsProvider from 'next-auth/providers/credentials';
import { connectToDatabase, getMongoClient } from '@/lib/db';
import User from './lib/db/models/user.model';
import NextAuth, { type DefaultSession } from 'next-auth';
import authConfig from './auth.config';
import Seller from '@/lib/db/models/seller.model';
import jwt from 'jsonwebtoken';

declare module 'next-auth' {
  interface Session {
    accessToken?: string;
    user: {
      role: string;
      storeId: string;
      nickname: string;
      token: string;
      storeName: string;
      locale: string;
      customSiteUrl?: string;
    } & DefaultSession['user'];
  }
}

export async function authenticateUser(credentials: { email: string; password: string }) {
  try {
    await connectToDatabase();
    const user = await User.findOne({ email: credentials.email }).select('+password');
    console.log('authenticateUser: User lookup:', {
      email: credentials.email,
      found: !!user,
      hasPassword: !!user?.password,
      emailVerified: user?.emailVerified,
      isActive: user?.isActive,
    });

    if (!user) {
      console.log('authenticateUser: No user found for email:', credentials.email);
      throw new Error('No user found');
    }

    if (!user.password) {
      console.log('authenticateUser: No password set for user:', credentials.email);
      throw new Error('This account uses Google sign-in. Please use the Google login option.');
    }

    const isMatch = await bcrypt.compare(credentials.password, user.password);
    console.log('authenticateUser: Password match:', isMatch);

    if (!isMatch) {
      console.log('authenticateUser: Password mismatch for user:', credentials.email);
      throw new Error('Invalid password');
    }

    if (!user.emailVerified || !user.isActive) {
      console.log('authenticateUser: User not verified or inactive:', {
        email: credentials.email,
        emailVerified: user.emailVerified,
        isActive: user.isActive,
      });
      throw new Error('Please verify your email before signing in');
    }

    const token = jwt.sign(
      { userId: user._id.toString(), email: user.email, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: '1h' }
    );

    console.log('authenticateUser: User authenticated:', {
      email: user.email,
      id: user._id.toString(),
    });

    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      token,
    };
  } catch (error) {
    console.error('authenticateUser: Error:', error);
    throw error;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  pages: {
    signIn: '/sign-in',
    newUser: '/sign-up',
    error: '/sign-in?error=CredentialsSignin',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  adapter: MongoDBAdapter(getMongoClient()),
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
    CredentialsProvider({
      credentials: {
        email: { type: 'email' },
        password: { type: 'password' },
      },
      async authorize(credentials) {
        console.log('authorize: Credentials received:', {
          email: credentials?.email,
          hasPassword: !!credentials?.password,
        });

        if (!credentials?.email || !credentials?.password) {
          console.log('authorize: Missing email or password');
          return null;
        }

        try {
          const user = await authenticateUser({
            email: credentials.email as string,
            password: credentials.password as string,
          });
          return user;
        } catch (error: any) {
          console.error('authorize: Error:', error.message);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user, trigger, session }) => {
      if (user) {
        if (!user.name) {
          await getMongoClient();
          await User.findByIdAndUpdate(user.id, {
            name: user.name || user.email!.split('@')[0],
            role: 'user',
            emailVerified: true,
          });
        }
        token.name = user.name || user.email!.split('@')[0];
        token.role = (user as { role: string }).role;
        token.id = user.id;
        token.token = (user as { token: string }).token;
      }

      if (session?.user?.name && trigger === 'update') {
        token.name = session.user.name;
      }
      return token;
    },
    session: async ({ session, user, trigger, token }) => {
      session.user.id = token.id as string;
      session.user.role = token.role as string;
      session.user.name = token.name;
      session.user.token = token.token as string;
      if (trigger === 'update') {
        session.user.name = user.name;
      }
      return session;
    },
  },
});