import { IsString, IsEnum, IsOptional, IsObject, IsNumber, IsArray, IsDate } from 'class-validator';
import { ModelFormat } from '../entities/ml-model.entity';

export class CreateModelDto {
  @IsString()
  name: string;

  @IsString()
  version: string;

  @IsEnum(ModelFormat)
  format: ModelFormat;

  @IsObject()
  metadata: {
    accuracy?: number;
    trainingDate?: Date;
    features?: string[];
    hyperparameters?: Record<string, any>;
    datasetInfo?: Record<string, any>;
    framework?: string;
    dependencies?: string[];
  };

  @IsObject()
  inputSchema: Record<string, any>;

  @IsObject()
  outputSchema: Record<string, any>;

  @IsOptional()
  @IsNumber()
  accuracy?: number;

  @IsOptional()
  @IsArray()
  features?: string[];
}
