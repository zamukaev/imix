import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AccessTokenPayload } from '@imix/types';
import type { Request } from 'express';

/**
 * The request once a guard has identified the caller. Handlers reach it through
 * `@CurrentUser()` rather than touching `request.user` themselves.
 */
export type AuthenticatedRequest = Request & {
  user?: AccessTokenPayload;
};

/**
 * Rejects anything without a valid `Authorization: Bearer <token>`.
 *
 * Written by hand rather than through Passport: the whole job is "parse a
 * header, verify a signature, attach the payload", and three extra dependencies
 * to express that is a poor trade.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = bearerToken(request);

    if (!token) {
      throw new UnauthorizedException('Authentication required.');
    }

    try {
      request.user = await this.jwt.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw new UnauthorizedException('Access token is invalid or expired.');
    }

    return true;
  }
}

/**
 * Identifies the caller when they present a token and shrugs when they do not.
 *
 * This is what keeps guest checkout a first-class flow: `POST /orders` wants to
 * stamp `userId` on the order of a signed-in shopper, and to behave exactly as
 * before for everyone else. A malformed token is still ignored rather than
 * rejected — the endpoint is public, so there is nothing to refuse.
 */
@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = bearerToken(request);

    if (token) {
      try {
        request.user = await this.jwt.verifyAsync<AccessTokenPayload>(token);
      } catch {
        request.user = undefined;
      }
    }

    return true;
  }
}

const BEARER_PREFIX = 'Bearer ';

function bearerToken(request: Request): string | null {
  const header = request.headers.authorization;

  if (!header?.startsWith(BEARER_PREFIX)) {
    return null;
  }

  const token = header.slice(BEARER_PREFIX.length).trim();

  return token.length > 0 ? token : null;
}
