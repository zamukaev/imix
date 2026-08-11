import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AuthResponse, UserDto } from '@imix/types';
import { Prisma } from '@prisma/client';
import { hash, verify } from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import {
  ACCESS_TOKEN_TTL,
  REFRESH_TOKEN_TTL,
  readSecret,
} from './auth.constants';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

/** Everything a `UserDto` needs, and deliberately not `passwordHash`. */
const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

type UserRow = Prisma.UserGetPayload<{ select: typeof userSelect }>;

/**
 * The refresh token says who, and nothing else. Role and email are re-read from
 * the database on every refresh, so a user promoted to ADMIN gets there within
 * one access-token lifetime rather than at their next login.
 */
type RefreshTokenPayload = {
  sub: string;
};

/**
 * One message for "no such account" and for "wrong password" alike. Two
 * different answers would turn the login form into a way to ask which email
 * addresses have signed up here.
 */
const INVALID_CREDENTIALS = 'Invalid email or password.';

@Injectable()
export class AuthService {
  private readonly refreshSecret = readSecret('JWT_REFRESH_SECRET');

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * Creates a USER. The role is never taken from the request — the first ADMIN
   * comes from the seed (`prisma/seed.ts`), and later ones from an admin
   * promoting them.
   */
  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('An account with this email already exists.');
    }

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash: await hash(dto.password),
        name: dto.name ?? null,
      },
      select: userSelect,
    });

    return this.issue(toUserDto(user));
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { ...userSelect, passwordHash: true },
    });

    // Verify against a throwaway hash when the account does not exist, so a
    // missing email and a wrong password cost the same time. Skipping the work
    // would let the response time answer the question the message refuses to.
    const passwordHash = user?.passwordHash ?? (await this.decoyHash());

    if (!(await verify(passwordHash, dto.password)) || !user) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const { passwordHash: _discarded, ...row } = user;

    return this.issue(toUserDto(row));
  }

  /**
   * Trades a refresh token for a fresh pair. Both tokens are reissued: the
   * session slides forward as long as it is being used, and stops thirty days
   * after it stopped being used.
   */
  async refresh(refreshToken: string): Promise<AuthResponse> {
    let payload: RefreshTokenPayload;

    try {
      payload = await this.jwt.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: this.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Refresh token is invalid or expired.');
    }

    const user = await this.findById(payload.sub);

    if (!user) {
      // The account was deleted while the token was still valid.
      throw new UnauthorizedException('Refresh token is invalid or expired.');
    }

    return this.issue(user);
  }

  /** The current row, so `GET /auth/me` never answers from a stale token. */
  async findById(id: string): Promise<UserDto | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });

    return user ? toUserDto(user) : null;
  }

  private async issue(dto: UserDto): Promise<AuthResponse> {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(
        { sub: dto.id, email: dto.email, role: dto.role },
        { expiresIn: ACCESS_TOKEN_TTL },
      ),
      this.jwt.signAsync(
        { sub: dto.id } satisfies RefreshTokenPayload,
        { secret: this.refreshSecret, expiresIn: REFRESH_TOKEN_TTL },
      ),
    ]);

    return { accessToken, refreshToken, user: dto };
  }

  /**
   * A hash of a value nobody can supply, computed once per process. Its only
   * job is to make `verify` do real work on an unknown email.
   */
  private decoyHashPromise: Promise<string> | null = null;

  private decoyHash(): Promise<string> {
    this.decoyHashPromise ??= hash(`decoy-${Date.now()}-${Math.random()}`);

    return this.decoyHashPromise;
  }
}

function toUserDto(user: UserRow): UserDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  };
}
