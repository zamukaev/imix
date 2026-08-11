import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { readSecret } from './auth.constants';
import { AuthService } from './auth.service';
import { JwtAuthGuard, OptionalJwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

/**
 * `JwtModule` is registered with the **access** secret, so signing and verifying
 * an access token needs no options at the call site. The refresh secret is
 * passed explicitly where it is used (`AuthService`) — two secrets means a
 * refresh token can never be presented as an access token, or the other way
 * round.
 */
@Module({
  imports: [
    JwtModule.register({
      secret: readSecret('JWT_SECRET'),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, OptionalJwtAuthGuard, RolesGuard],
  exports: [JwtAuthGuard, OptionalJwtAuthGuard, RolesGuard, JwtModule],
})
export class AuthModule {}
