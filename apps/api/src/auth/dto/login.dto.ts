import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length } from 'class-validator';
import { MAX_PASSWORD_LENGTH, type LoginRequest } from '@imix/types';
import { MAX_EMAIL_LENGTH, normaliseEmail } from './register.dto';

export class LoginDto implements LoginRequest {
  @Transform(normaliseEmail)
  @IsEmail({}, { message: 'email must be a valid address' })
  @Length(1, MAX_EMAIL_LENGTH)
  email!: string;

  // Deliberately no minimum length here. The rule belongs on registration; on
  // login a short password is simply a wrong one, and a 400 that only fires for
  // short inputs tells an attacker something about the password policy.
  @IsString()
  @Length(1, MAX_PASSWORD_LENGTH)
  password!: string;
}
