import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsNotEmpty, Min } from 'class-validator';

export class ProjectMetadataDto {
  @ApiProperty({
    description: 'Project name',
    example: 'My DeFi Project',
  })
  name: string;

  @ApiPropertyOptional({
    description: 'Project description',
    example: 'A revolutionary DeFi protocol on Stellar',
  })
  description?: string;

  @ApiPropertyOptional({
    description: 'Project website URL',
    example: 'https://myproject.io',
  })
  website?: string;

  @ApiPropertyOptional({
    description: 'Project logo URL',
    example: 'ipfs://QmXxx...',
  })
  logo?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    example: { category: 'DeFi', chain: 'Stellar' },
  })
  metadata?: Record<string, any>;
}

export class PinMetadataResponseDto {
  @ApiProperty({
    description: 'IPFS Content Identifier (CID)',
    example: 'QmXxxYyyZzz...',
  })
  cid: string;
}

export class BannerUploadDto {
  @ApiProperty({
    description: 'Path to the banner image file',
    example: '/tmp/banner.png',
  })
  @IsString()
  @IsNotEmpty()
  imagePath: string;

  @ApiPropertyOptional({
    description: 'Target width for optimization',
    example: 1200,
  })
  @IsNumber()
  @Min(1)
  @IsOptional()
  width?: number;

  @ApiPropertyOptional({
    description: 'Target height for optimization',
    example: 630,
  })
  @IsNumber()
  @Min(1)
  @IsOptional()
  height?: number;
}

export class VerifyHashDto {
  @ApiProperty({
    description: 'IPFS hash to verify',
    example: 'QmXxxYyyZzz...',
  })
  @IsString()
  @IsNotEmpty()
  hash: string;
}

export class VerifyHashResponseDto {
  @ApiProperty({
    description: 'Hash verification result',
    example: true,
  })
  valid: boolean;
}
