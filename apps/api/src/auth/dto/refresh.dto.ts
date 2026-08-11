import { IsString, Length } from 'class-validator';
import type { RefreshRequest } from '@imix/types';

/** Generous: a JWT grows with its claims and this one is not ours to bound. */
const MAX_TOKEN_LENGTH = 4096;

export class RefreshDto implements RefreshRequest {
  @IsString()
  @Length(1, MAX_TOKEN_LENGTH)
  refreshToken!: string;
}
