import NextAuth, { type NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { MongoDBAdapter } from '@auth/mongodb-adapter';
import clientPromise from './db/client';
import bcrypt from 'bcryptjs';
import User from './db/models/user.model';
import { connectToDatabase } from './db';

export const authOptions: NextAuthOptions = {
  adapter: MongoDBAdapter(clientPromise),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Missing email or password');
        }
        await connectToDatabase();
        const user = await User.findOne({ email: credentials.email }).select('+password');
        if (!user) {
          throw new Error('No user found');
        }
        if (!user.password) {
          throw new Error('This account uses Google sign-in. Please use the Google login option.');
        }
        const isMatch = await bcrypt.compare(credentials.password, user.password);
        if (!isMatch) {
          throw new Error('Invalid password');
        }
        if (!user.emailVerified || !user.isActive) {
          throw new Error('Please verify your email or activate your account');
        }
        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          points: user.points,
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.points = user.points;
        token.name = user.name || user.email!.split('@')[0];
      }
      if (trigger === 'update' && session?.user?.name) {
        token.name = session.user.name;
      }
      await connectToDatabase();
      const dbUser = await User.findOne({ email: token.email });
      if (dbUser) {
        token.role = dbUser.role;
        token.points = dbUser.points;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.points = token.points as number;
        session.user.name = token.name as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/[locale]/sign-in',
    error: '/[locale]/auth/error',
    newUser: '/[locale]/sign-up',
  },
};

export default NextAuth(authOptions);