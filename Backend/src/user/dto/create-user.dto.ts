import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { sanitizeString, sanitizeUnknown } from '../../common/utils/sanitize.util';
import { IsStellarWalletAddress } from '../validators/is-stellar-wallet-address.validator';

export class CreateUserDto {
  @IsString()
  @IsStellarWalletAddress()
  walletAddress: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  @Transform(({ value }) => (typeof value === 'string' ? sanitizeString(value).toLowerCase() : value))
  email?: string;

  @IsOptional()
  @IsObject()
  @Transform(({ value }) => sanitizeUnknown(value))
  profileData?: Record<string, unknown>;
}
