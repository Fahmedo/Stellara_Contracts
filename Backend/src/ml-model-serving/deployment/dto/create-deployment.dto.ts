import { IsString, IsEnum, IsObject, IsNumber, IsOptional, IsBoolean } from 'class-validator';
import { DeploymentType } from '../model-deployment.entity';

export class CreateDeploymentDto {
  @IsString()
  modelId: string;

  @IsString()
  name: string;

  @IsEnum(DeploymentType)
  type: DeploymentType;

  @IsObject()
  config: {
    replicas: number;
    minReplicas: number;
    maxReplicas: number;
    cpuRequest: string;
    cpuLimit: string;
    memoryRequest: string;
    memoryLimit: string;
    gpuRequest?: string;
    gpuLimit?: string;
    autoScaling: {
      enabled: boolean;
      targetCPUUtilization?: number;
      targetMemoryUtilization?: number;
      scaleUpCooldown: number;
      scaleDownCooldown: number;
    };
    traffic: {
      percentage: number;
      canaryRules?: {
        header?: string;
        value?: string;
        percentage?: number;
      };
    };
    environment: Record<string, string>;
  };

  @IsOptional()
  @IsObject()
  rollbackConfig?: {
    enabled: boolean;
    timeout: number;
    previousDeploymentId?: string;
    rollbackThresholds: {
      errorRate: number;
      latencyP95: number;
      latencyP99: number;
    };
  };
}
