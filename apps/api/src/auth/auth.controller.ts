import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { AccessTokenPayload, AuthResponse, UserDto } from '@imix/types';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

/**
 * Tokens leave in the response body and never in a `Set-Cookie`.
 *
 * The storefront runs on a different origin, so an API-set cookie would need
 * `SameSite=None; Secure` and would not survive local development. Instead the
 * web app owns the browser session: its route handlers call these endpoints and
 * put the tokens into httpOnly cookies of its own (ARCHITECTURE.md §4).
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto): Promise<AuthResponse> {
    return this.auth.register(dto);
  }

  // 200, not 201: logging in creates nothing at a URL the client can go back to.
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto): Promise<AuthResponse> {
    return this.auth.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshDto): Promise<AuthResponse> {
    return this.auth.refresh(dto.refreshToken);
  }

  /**
   * The current user, read from the database rather than restated from the
   * token — the storefront uses it to confirm a session is still real.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() current?: AccessTokenPayload): Promise<UserDto> {
    // `current` is always set behind JwtAuthGuard; the optional type is what
    // makes the same decorator usable on a public route.
    const user = current ? await this.auth.findById(current.sub) : null;

    if (!user) {
      throw new NotFoundException('This account no longer exists.');
    }

    return user;
  }
}
