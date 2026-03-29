import { PartialType } from '@nestjs/mapped-types';
import { CreateModelDto } from './create-model.dto';
import { ModelStatus } from '../entities/ml-model.entity';
import { IsEnum, IsOptional } from 'class-validator';

export class UpdateModelDto extends PartialType(CreateModelDto) {
  @IsOptional()
  @IsEnum(ModelStatus)
  status?: ModelStatus;

  @IsOptional()
  isProduction?: boolean;
}
