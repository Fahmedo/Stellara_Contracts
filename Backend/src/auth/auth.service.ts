import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { createHash } from 'node:crypto';
import { SessionService } from '../sessions/session.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private readonly sessionService: SessionService,
    private readonly redisService: RedisService,
  ) {}

  async login(walletAddress: string, request: Request) {
    const subscriptionTier = this.resolveSubscriptionTier(request);
    const user = {
      id: this.deriveUserId(walletAddress),
      walletAddress,
      roles: this.resolveRoles(subscriptionTier),
    };
    const sessionId = this.sessionService.createSessionId();
    const tokens = await this.getTokens(
      user.id,
      walletAddress,
      user.roles,
      sessionId,
      subscriptionTier,
    );
    await this.sessionService.createSession(
      {
        id: user.id,
        walletAddress: user.walletAddress,
        roles: user.roles,
        subscriptionTier,
      },
      sessionId,
      tokens.refreshToken,
      request,
    );

    return {
      ...tokens,
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        roles: user.roles,
        subscriptionTier,
      },
    };
  }

  async logout(userId: string, accessToken?: string, sessionId?: string) {
    let resolvedSessionId = sessionId;

    if (accessToken) {
      // Decode to get expiration and blacklist it
      try {
        const decoded: any = this.jwtService.decode(accessToken);
        if (decoded && decoded.exp) {
          const expiresAt = new Date(decoded.exp * 1000);
          await this.blacklistAccessToken(accessToken, expiresAt);
        }
        if (!resolvedSessionId && decoded?.sid) {
          resolvedSessionId = decoded.sid;
        }
      } catch (e) {
        // Ignored
      }
    }

    if (resolvedSessionId) {
      await this.sessionService.terminateSession(
        userId,
        resolvedSessionId,
        'logout',
      );
    }
  }

  async refreshTokens(refreshToken: string, request: Request) {
    try {
      const decoded = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET', 'super_refresh_secret_key_for_development'),
      });

      const sessionId = decoded.sid as string | undefined;
      if (!sessionId) {
        throw new UnauthorizedException('Session information is missing');
      }

      await this.sessionService.validateRefreshSession(
        decoded.sub,
        sessionId,
        refreshToken,
      );

      const subscriptionTier = String(
        decoded.subscriptionTier || 'free',
      ).toLowerCase();
      const tokens = await this.getTokens(
        decoded.sub,
        decoded.walletAddress,
        decoded.roles || ['USER'],
        sessionId,
        subscriptionTier,
      );
      await this.sessionService.rotateRefreshToken(
        decoded.sub,
        sessionId,
        tokens.refreshToken,
        request,
      );

      return tokens;
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async isTokenBlacklisted(token: string): Promise<boolean> {
    const key = this.blacklistKey(token);
    return Boolean(await this.redisService.getClient().get(key));
  }

  private async getTokens(
    userId: string,
    walletAddress: string,
    roles: string[],
    sessionId: string,
    subscriptionTier: string,
  ) {
    const payload = {
      sub: userId,
      walletAddress,
      roles,
      sid: sessionId,
      subscriptionTier,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_SECRET', 'super_secret_key_for_development'),
        expiresIn: this.configService.get<any>('JWT_EXPIRATION', '15m'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET', 'super_refresh_secret_key_for_development'),
        expiresIn: this.configService.get<any>('JWT_REFRESH_EXPIRATION', '7d'),
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  private resolveSubscriptionTier(user: any): string {
    const headerTier = String(
      user.headers['x-subscription-tier'] || 'free',
    ).toLowerCase();

    if (
      headerTier === 'free' ||
      headerTier === 'pro' ||
      headerTier === 'enterprise'
    ) {
      return headerTier;
    }

    return 'free';
  }

  private resolveRoles(subscriptionTier: string): string[] {
    if (subscriptionTier === 'enterprise') {
      return ['SUPER_ADMIN'];
    }

    if (subscriptionTier === 'pro') {
      return ['TENANT_ADMIN'];
    }

    return ['USER'];
  }

  private deriveUserId(walletAddress: string): string {
    return createHash('sha256').update(walletAddress).digest('hex');
  }

  private async blacklistAccessToken(token: string, expiresAt: Date): Promise<void> {
    const ttlSeconds = Math.max(
      1,
      Math.ceil((expiresAt.getTime() - Date.now()) / 1000),
    );
    await this.redisService
      .getClient()
      .set(this.blacklistKey(token), '1', 'EX', ttlSeconds);
  }

  private blacklistKey(token: string): string {
    return `blacklist:${createHash('sha256').update(token).digest('hex')}`;
  }
}
