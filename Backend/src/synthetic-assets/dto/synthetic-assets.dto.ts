import { IsString, IsNumber, IsNotEmpty, Min, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OpenCDPDto {
  @ApiProperty({ example: 'user-id-123' })
  @IsString() @IsNotEmpty()
  userId: string;

  @ApiProperty({ example: 'sGOLD', description: 'Synthetic asset symbol' })
  @IsString() @IsNotEmpty()
  syntheticSymbol: string;

  @ApiProperty({ example: 'XLM' })
  @IsString() @IsNotEmpty()
  collateralSymbol: string;

  @ApiProperty({ example: 1000 })
  @IsNumber() @Min(0.0001)
  collateralAmount: number;
}

export class MintSyntheticDto {
  @ApiProperty({ example: 'user-id-123' })
  @IsString() @IsNotEmpty()
  userId: string;

  @ApiProperty({ example: 'cdp-id-456' })
  @IsString() @IsNotEmpty()
  cdpId: string;

  @ApiProperty({ example: 0.5 })
  @IsNumber() @Min(0.000001)
  mintAmount: number;
}

export class BurnSyntheticDto {
  @ApiProperty({ example: 'user-id-123' })
  @IsString() @IsNotEmpty()
  userId: string;

  @ApiProperty({ example: 'cdp-id-456' })
  @IsString() @IsNotEmpty()
  cdpId: string;

  @ApiProperty({ example: 0.1 })
  @IsNumber() @Min(0.000001)
  burnAmount: number;
}

export class AddCollateralDto {
  @ApiProperty({ example: 'user-id-123' })
  @IsString() @IsNotEmpty()
  userId: string;

  @ApiProperty({ example: 'cdp-id-456' })
  @IsString() @IsNotEmpty()
  cdpId: string;

  @ApiProperty({ example: 500 })
  @IsNumber() @Min(0.0001)
  amount: number;
}

export class WithdrawCollateralDto {
  @ApiProperty({ example: 'user-id-123' })
  @IsString() @IsNotEmpty()
  userId: string;

  @ApiProperty({ example: 'cdp-id-456' })
  @IsString() @IsNotEmpty()
  cdpId: string;

  @ApiProperty({ example: 100 })
  @IsNumber() @Min(0.0001)
  amount: number;
}

export class UpdateOraclePriceDto {
  @ApiProperty({ example: 'sGOLD' })
  @IsString() @IsNotEmpty()
  syntheticSymbol: string;

  @ApiProperty({ example: 2350.50 })
  @IsNumber() @Min(0)
  price: number;

  @ApiProperty({ example: 'chainlink' })
  @IsString() @IsNotEmpty()
  source: string;

  @ApiPropertyOptional({ example: 0.98 })
  @IsNumber() @IsOptional()
  confidence?: number;
}

export class SeedAssetsDto {
  @ApiPropertyOptional({ description: 'Seed default synthetic assets (sGOLD, sSPX, sEUR, sOIL)' })
  force?: boolean;
}
