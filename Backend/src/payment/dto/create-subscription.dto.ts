import { IsString, IsOptional, IsBoolean, IsEmail } from 'class-validator';

export class CreateSubscriptionDto {
  @IsString()
  tenantId: string;

  @IsString()
  planId: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  paymentMethodId?: string;

  @IsBoolean()
  @IsOptional()
  trialPeriodDays?: number;
}
