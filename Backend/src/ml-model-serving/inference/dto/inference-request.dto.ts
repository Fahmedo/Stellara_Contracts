import { IsString, IsOptional, IsObject } from 'class-validator';

export class InferenceRequestDto {
  @IsString()
  modelName: string;

  @IsOptional()
  @IsString()
  version?: string;

  @IsObject()
  input: any;

  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;
}

export class BatchInferenceRequestDto {
  @IsString()
  modelName: string;

  @IsOptional()
  @IsString()
  version?: string;

  inputs: any[];
}
