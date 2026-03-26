import { IsString, IsInt, IsOptional, IsNumber } from 'class-validator';

export class CreateUsageRecordDto {
  @IsString()
  tenantId: string;

  @IsString()
  metricName: string;

  @IsInt()
  quantity: number;

  @IsNumber()
  @IsOptional()
  timestamp?: number;
}
