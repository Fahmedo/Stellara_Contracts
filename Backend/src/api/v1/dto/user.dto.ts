import { IsEmail, IsString, IsOptional, IsNumber, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ description: 'User email address', example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'User display name', example: 'John Doe' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'User wallet address', example: 'GD5...' })
  @IsString()
  @IsOptional()
  walletAddress?: string;

  @ApiPropertyOptional({ description: 'User profile data', example: { bio: 'Software developer' } })
  @IsOptional()
  profileData?: any;
}

export class UpdateUserDto {
  @ApiPropertyOptional({ description: 'User email address', example: 'user@example.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ description: 'User display name', example: 'John Doe' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'User wallet address', example: 'GD5...' })
  @IsString()
  @IsOptional()
  walletAddress?: string;

  @ApiPropertyOptional({ description: 'User profile data', example: { bio: 'Software developer' } })
  @IsOptional()
  profileData?: any;
}

export class UserResponseDto {
  @ApiProperty({ description: 'User unique identifier', example: 'cuid...' })
  id: string;

  @ApiProperty({ description: 'User email address', example: 'user@example.com' })
  email: string;

  @ApiProperty({ description: 'User display name', example: 'John Doe' })
  name: string;

  @ApiPropertyOptional({ description: 'User wallet address', example: 'GD5...' })
  walletAddress?: string;

  @ApiPropertyOptional({ description: 'User profile data', example: { bio: 'Software developer' } })
  profileData?: any;

  @ApiProperty({ description: 'User reputation score', example: 750 })
  reputationScore: number;

  @ApiProperty({ description: 'User trust score', example: 500 })
  trustScore: number;

  @ApiProperty({ description: 'Account creation date', example: '2024-01-01T00:00:00.000Z' })
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ description: 'Last update date', example: '2024-01-01T00:00:00.000Z' })
  @Type(() => Date)
  updatedAt: Date;
}
