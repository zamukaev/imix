import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, Length } from 'class-validator';
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  type RegisterRequest,
} from '@imix/types';

export const MAX_EMAIL_LENGTH = 254;
export const MAX_NAME_LENGTH = 120;

export const normaliseEmail = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

const trimmed = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class RegisterDto implements RegisterRequest {
  @Transform(normaliseEmail)
  @IsEmail({}, { message: 'email must be a valid address' })
  @Length(1, MAX_EMAIL_LENGTH)
  email!: string;

  // Not trimmed: leading and trailing spaces are part of a password somebody
  // may well have typed on purpose, and silently dropping them would lock them
  // out of the account they just created.
  @IsString()
  @Length(MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH)
  password!: string;

  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @Length(1, MAX_NAME_LENGTH)
  name?: string;
}
