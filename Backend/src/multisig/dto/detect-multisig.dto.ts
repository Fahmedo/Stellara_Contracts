import { IsString, IsNotEmpty } from 'class-validator';

export class DetectMultisigDto {
  @IsString()
  @IsNotEmpty()
  accountId: string;
}
