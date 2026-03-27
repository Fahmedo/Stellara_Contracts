import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class HealthCheckDto {
  @ApiProperty({
    description: 'Health status',
    example: 'ok',
  })
  status: string;

  @ApiProperty({
    description: 'Current server timestamp',
    example: '2024-01-15T10:30:00.000Z',
  })
  timestamp: string;
}

export class UserResponseDto {
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

export class UserNotFoundDto {
  @ApiProperty({
    description: 'Error message',
    example: 'User not found',
  })
  error: string;
}
