import { MongoDBAdapter } from '@auth/mongodb-adapter';
import Google from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import CredentialsProvider from 'next-auth/providers/credentials';
import { connectToDatabase } from './lib/db';
import client from './lib/db/client';
import User from './lib/db/models/user.model';
import NextAuth, { type DefaultSession } from 'next-auth';
import authConfig from './auth.config';

declare module 'next-auth' {
  interface Session {
    user: {
      role: string;
    } & DefaultSession['user'];
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
    maxAge: 30 * 24 * 60 * 60, // 30 يوم
  },
  adapter: MongoDBAdapter(client),
  providers: [
    Google({
      allowDangerousEmailAccountLinking: true,
    }),
    CredentialsProvider({
      credentials: {
        email: { type: 'email' },
        password: { type: 'password' },
      },
      async authorize(credentials) {
        await connectToDatabase();
        console.log('Authorize: Credentials received:', {
          email: credentials?.email,
          hasPassword: !!credentials?.password,
        });

        if (!credentials?.email || !credentials?.password) {
          console.log('Authorize: Missing email or password');
          return null;
        }

        try {
          const user = await User.findOne({ email: credentials.email }).select('+password');
          console.log('Authorize: User found:', user ? {
            email: user.email,
            hasPassword: !!user.password,
            emailVerified: user.emailVerified,
            isActive: user.isActive,
          } : 'No user found');

          if (!user) {
            console.log('Authorize: No user found with email:', credentials.email);
            return null;
          }

          if (!user.password) {
            console.log('Authorize: User has no password set (likely OAuth user):', credentials.email);
            throw new Error('This account uses Google sign-in. Please use the Google login option.');
          }

          const isMatch = await bcrypt.compare(credentials.password as string, user.password);
          console.log('Authorize: Password match:', isMatch);

          if (!isMatch) {
            console.log('Authorize: Password mismatch for user:', credentials.email);
            return null;
          }

          if (!user.emailVerified || !user.isActive) {
            console.log('Authorize: User not verified or inactive:', {
              email: credentials.email,
              emailVerified: user.emailVerified,
              isActive: user.isActive,
            });
            throw new Error('Please verify your email before signing in');
          }

          console.log('Authorize: User authorized:', {
            email: user.email,
            id: user._id.toString(),
          });

          return {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            role: user.role,
          };
        } catch (error: any) {
          console.error('Authorize: Error:', error.message);
          throw error;
        }
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user, trigger, session }) => {
      if (user) {
        if (!user.name) {
          await connectToDatabase();
          await User.findByIdAndUpdate(user.id, {
            name: user.name || user.email!.split('@')[0],
            role: 'user',
          });
        }
        token.name = user.name || user.email!.split('@')[0];
        token.role = (user as { role: string }).role;
      }

      if (session?.user?.name && trigger === 'update') {
        token.name = session.user.name;
      }
      return token;
    },
    session: async ({ session, user, trigger, token }) => {
      session.user.id = token.sub as string;
      session.user.role = token.role as string;
      session.user.name = token.name;
      if (trigger === 'update') {
        session.user.name = user.name;
      }
      return session;
    },
  },
});