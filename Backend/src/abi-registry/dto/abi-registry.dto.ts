import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AbiFunctionArgumentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  value?: unknown;
}

export class UpsertAbiRegistryDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  contractAddress: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  contractType: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  displayName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  network?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  version: string;

  @ApiProperty()
  @IsObject()
  abiSchema: Record<string, unknown>;

  @ApiProperty()
  @IsObject()
  contractSchema: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  functionSchemas?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  eventSchemas?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  markAsCurrent?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  changelog?: string;

  @ApiPropertyOptional()
  @IsOptional()
  compatibility?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class DecodeContractResultDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  functionName: string;

  @ApiPropertyOptional()
  @IsOptional()
  rawResult?: unknown;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  version?: string;
}

export class PrepareInvocationDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  functionName: string;

  @ApiProperty({ type: [AbiFunctionArgumentDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AbiFunctionArgumentDto)
  arguments: AbiFunctionArgumentDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  version?: string;
}

export class ParseContractEventDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  topics?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  data?: unknown;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  eventName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  version?: string;
}
