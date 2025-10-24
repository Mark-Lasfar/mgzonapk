import { connectToDatabase } from '@/lib/db';
import Client, { IClient } from '@/lib/db/models/client.model';
import AuthCode from '@/lib/db/models/auth-code.model';
import AccessToken from '@/lib/db/models/access-token.model';
import User from '@/lib/db/models/user.model';
import { customLogger } from '@/lib/api/services/logging';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

export class OAuthService {
  static async generateAuthCode(params: {
    clientId: string;
    userId: string;
    redirectUri: string;
    scopes: string[];
  }): Promise<string> {
    await connectToDatabase();
    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      const client = await Client.findOne({ clientId: params.clientId, isActive: true }).session(session);
      if (!client) {
        throw new Error('Invalid client');
      }

      if (!client.redirectUris.includes(params.redirectUri)) {
        throw new Error('Invalid redirect URI');
      }

      if (!params.scopes.every((scope) => client.scopes.includes(scope))) {
        throw new Error('Invalid scopes');
      }

      const authCode = await AuthCode.create(
        [{
          clientId: params.clientId,
          userId: params.userId,
          redirectUri: params.redirectUri,
          scopes: params.scopes,
        }],
        { session }
      );

      await customLogger.info('Authorization code generated', {
        clientId: params.clientId,
        userId: params.userId,
        timestamp: new Date(),
        service: 'oauth',
      });

      await session.commitTransaction();
      return authCode[0].code;
    } catch (error) {
      await session.abortTransaction();
      await customLogger.error('Failed to generate auth code', {
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        service: 'oauth',
      });
      throw error;
    } finally {
      await session.endSession();
    }
  }

  static async exchangeAuthCode(params: {
    code: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  }): Promise<{ accessToken: string; refreshToken: string; expiresIn: number; scopes: string[] }> {
    await connectToDatabase();
    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      const authCode = await AuthCode.findOne({ code: params.code }).session(session);
      if (!authCode || authCode.expiresAt < new Date()) {
        throw new Error('Invalid or expired authorization code');
      }

      const client = await Client.findOne({ clientId: params.clientId, clientSecret: params.clientSecret, isActive: true }).session(session);
      if (!client) {
        throw new Error('Invalid client credentials');
      }

      if (authCode.redirectUri !== params.redirectUri) {
        throw new Error('Invalid redirect URI');
      }

      const accessToken = await AccessToken.create(
        [{
          clientId: params.clientId,
          userId: authCode.userId,
          scopes: authCode.scopes,
        }],
        { session }
      );

      await AuthCode.deleteOne({ code: params.code }).session(session);

      await customLogger.info('Access token generated', {
        clientId: params.clientId,
        userId: authCode.userId,
        timestamp: new Date(),
        service: 'oauth',
      });

      await session.commitTransaction();
      return {
        accessToken: accessToken[0].accessToken,
        refreshToken: accessToken[0].refreshToken,
        expiresIn: 3600,
        scopes: accessToken[0].scopes,
      };
    } catch (error) {
      await session.abortTransaction();
      await customLogger.error('Failed to exchange auth code', {
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        service: 'oauth',
      });
      throw error;
    } finally {
      await session.endSession();
    }
  }

  static async refreshAccessToken(params: {
    refreshToken: string;
    clientId: string;
    clientSecret: string;
  }): Promise<{ accessToken: string; refreshToken: string; expiresIn: number; scopes: string[] }> {
    await connectToDatabase();
    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      const oldToken = await AccessToken.findOne({ refreshToken: params.refreshToken }).session(session);
      if (!oldToken) {
        throw new Error('Invalid refresh token');
      }

      const client = await Client.findOne({ clientId: params.clientId, clientSecret: params.clientSecret, isActive: true }).session(session);
      if (!client) {
        throw new Error('Invalid client credentials');
      }

      const newToken = await AccessToken.create(
        [{
          clientId: params.clientId,
          userId: oldToken.userId,
          scopes: oldToken.scopes,
        }],
        { session }
      );

      await AccessToken.deleteOne({ refreshToken: params.refreshToken }).session(session);

      await customLogger.info('Access token refreshed', {
        clientId: params.clientId,
        userId: oldToken.userId,
        timestamp: new Date(),
        service: 'oauth',
      });

      await session.commitTransaction();
      return {
        accessToken: newToken[0].accessToken,
        refreshToken: newToken[0].refreshToken,
        expiresIn: 3600,
        scopes: newToken[0].scopes,
      };
    } catch (error) {
      await session.abortTransaction();
      await customLogger.error('Failed to refresh access token', {
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        service: 'oauth',
      });
      throw error;
    } finally {
      await session.endSession();
    }
  }

  static async validateAccessToken(accessToken: string): Promise<{ userId: string; scopes: string[] } | null> {
    await connectToDatabase();
    const token = await AccessToken.findOne({ accessToken, expiresAt: { $gt: new Date() } });
    if (!token) {
      return null;
    }
    return {
      userId: token.userId,
      scopes: token.scopes,
    };
  }
}