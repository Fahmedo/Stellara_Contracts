import { PartialType } from '@nestjs/mapped-types';
import { CreateDeploymentDto } from './create-deployment.dto';
import { DeploymentStatus } from '../model-deployment.entity';
import { IsEnum, IsOptional } from 'class-validator';

export class UpdateDeploymentDto extends PartialType(CreateDeploymentDto) {
  @IsOptional()
  @IsEnum(DeploymentStatus)
  status?: DeploymentStatus;
}
