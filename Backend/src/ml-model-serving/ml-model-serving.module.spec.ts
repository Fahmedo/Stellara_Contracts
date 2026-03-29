import { Test, TestingModule } from '@nestjs/testing';
import { MLModelServingModule } from './ml-model-serving.module';
import { ModelRegistryService } from './model-registry/model-registry.service';
import { InferenceService } from './inference/inference.service';
import { DeploymentService } from './deployment/deployment.service';
import { MonitoringService } from './monitoring/monitoring.service';
import { DriftDetectionService } from './drift-detection/drift-detection.service';

describe('MLModelServingModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [MLModelServingModule],
    }).compile();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should provide ModelRegistryService', () => {
    const service = module.get<ModelRegistryService>(ModelRegistryService);
    expect(service).toBeDefined();
  });

  it('should provide InferenceService', () => {
    const service = module.get<InferenceService>(InferenceService);
    expect(service).toBeDefined();
  });

  it('should provide DeploymentService', () => {
    const service = module.get<DeploymentService>(DeploymentService);
    expect(service).toBeDefined();
  });

  it('should provide MonitoringService', () => {
    const service = module.get<MonitoringService>(MonitoringService);
    expect(service).toBeDefined();
  });

  it('should provide DriftDetectionService', () => {
    const service = module.get<DriftDetectionService>(DriftDetectionService);
    expect(service).toBeDefined();
  });

  afterEach(async () => {
    await module.close();
  });
});
