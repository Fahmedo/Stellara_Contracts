import { IsString, IsNotEmpty } from 'class-validator';

export class AddSignatureDto {
  @IsString()
  @IsNotEmpty()
  signerAddress: string;

  @IsString()
  @IsNotEmpty()
  signedXdr: string;
}
