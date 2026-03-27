import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateProposalDto {
  @IsString()
  @IsNotEmpty()
  multiSigId: string;

  @IsString()
  @IsNotEmpty()
  xdr: string;

  @IsString()
  @IsOptional()
  description?: string;
}
