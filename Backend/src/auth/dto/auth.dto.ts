import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'Wallet address for authentication',
    example: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890',
  })
  @IsString()
  @IsNotEmpty()
  walletAddress: string;
}

export class LoginResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Logged in successfully',
  })
  message: string;

  @ApiProperty({
    description: 'JWT access token for API authentication',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  @ApiProperty({
    description: 'JWT refresh token for token renewal',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  refreshToken: string;

  @ApiProperty({
    description: 'Authenticated user information',
    type: 'object',
    example: {
      id: 'cm3x1234567890',
      walletAddress: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890',
      reputationScore: 100,
      trustScore: 50,
    },
  })
  user: any;
}

export class RefreshTokenDto {
  @ApiPropertyOptional({
    description: 'Refresh token (optional if sent via cookie)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  @IsOptional()
  refreshToken?: string;
}

export class RefreshResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Tokens refreshed successfully',
  })
  message: string;

  @ApiProperty({
    description: 'New JWT access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  @ApiProperty({
    description: 'New JWT refresh token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  refreshToken: string;
}

export class LogoutResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Logged out successfully',
  })
  message: string;
}

export class UserProfileDto {
  @ApiProperty({
    description: 'User unique identifier',
    example: 'cm3x1234567890',
  })
  id: string;

  @ApiProperty({
    description: 'User wallet address',
    example: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890',
  })
  walletAddress: string;

  @ApiProperty({
    description: 'User reputation score',
    example: 100,
  })
  reputationScore: number;

  @ApiProperty({
    description: 'User trust score',
    example: 50,
  })
  trustScore: number;

  @ApiProperty({
    description: 'Account creation timestamp',
    example: '2024-01-15T10:30:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2024-01-15T10:30:00.000Z',
  })
  updatedAt: Date;
}
