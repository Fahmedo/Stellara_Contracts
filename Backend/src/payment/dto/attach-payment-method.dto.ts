import { IsString, IsBoolean, IsOptional } from 'class-validator';

export class AttachPaymentMethodDto {
  @IsString()
  tenantId: string;

  @IsString()
  paymentMethodId: string;

  @IsBoolean()
  @IsOptional()
  setAsDefault?: boolean;
}
