import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NonceResponseDto {
  @ApiProperty({
    description: 'Generated nonce for transaction signing',
    example: 'a1b2c3d4e5f6g7h8i9j0',
  })
  nonce: string;
}

export class NonceDataDto {
  @ApiProperty({
    description: 'Unique nonce value',
    example: 'a1b2c3d4e5f6g7h8i9j0',
  })
  nonce: string;

  @ApiProperty({
    description: 'Timestamp when nonce was generated',
    example: '2024-01-15T10:30:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Nonce expiration timestamp',
    example: '2024-01-15T10:35:00.000Z',
  })
  expiresAt: Date;
}
