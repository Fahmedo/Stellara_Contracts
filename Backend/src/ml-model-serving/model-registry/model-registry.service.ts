import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { MLModel, ModelFormat, ModelStatus } from './entities/ml-model.entity';
import { CreateModelDto } from './dto/create-model.dto';
import { UpdateModelDto } from './dto/update-model.dto';
import { RedisService } from '../../redis/redis.service';
import { StorageService } from '../../storage/storage.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class ModelRegistryService {
  constructor(
    @InjectRepository(MLModel)
    private readonly modelRepository: Repository<MLModel>,
    private readonly redisService: RedisService,
    private readonly storageService: StorageService,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(createModelDto: CreateModelDto, modelFile: Buffer): Promise<MLModel> {
    const existingModel = await this.modelRepository.findOne({
      where: { name: createModelDto.name, version: createModelDto.version },
    });

    if (existingModel) {
      throw new ConflictException(`Model ${createModelDto.name} v${createModelDto.version} already exists`);
    }

    const modelPath = await this.storageService.uploadModel(
      createModelDto.name,
      createModelDto.version,
      modelFile,
    );

    const model = this.modelRepository.create({
      ...createModelDto,
      modelPath,
      status: ModelStatus.READY,
    });

    const savedModel = await this.modelRepository.save(model);

    await this.redisService.del(`models:${createModelDto.name}:versions`);
    
    this.eventEmitter.emit('model.registered', {
      modelId: savedModel.id,
      name: savedModel.name,
      version: savedModel.version,
    });

    return savedModel;
  }

  async findAll(name?: string, status?: ModelStatus): Promise<MLModel[]> {
    const where: any = {};
    if (name) where.name = name;
    if (status) where.status = status;

    return this.modelRepository.find({
      where,
      order: { createdAt: 'DESC' },
      relations: ['deployments'],
    });
  }

  async findOne(id: string): Promise<MLModel> {
    const model = await this.modelRepository.findOne({
      where: { id },
      relations: ['deployments', 'metrics'],
    });

    if (!model) {
      throw new NotFoundException(`Model with ID ${id} not found`);
    }

    return model;
  }

  async findByNameAndVersion(name: string, version: string): Promise<MLModel> {
    const cacheKey = `model:${name}:${version}`;
    const cached = await this.redisService.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    const model = await this.modelRepository.findOne({
      where: { name, version },
      relations: ['deployments'],
    });

    if (!model) {
      throw new NotFoundException(`Model ${name} v${version} not found`);
    }

    await this.redisService.setex(cacheKey, 300, JSON.stringify(model));
    return model;
  }

  async getLatestVersion(name: string): Promise<MLModel> {
    const cacheKey = `model:${name}:latest`;
    const cached = await this.redisService.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    const model = await this.modelRepository.findOne({
      where: { name },
      order: { version: 'DESC' },
    });

    if (!model) {
      throw new NotFoundException(`No models found for ${name}`);
    }

    await this.redisService.setex(cacheKey, 600, JSON.stringify(model));
    return model;
  }

  async getProductionModel(name: string): Promise<MLModel> {
    const cacheKey = `model:${name}:production`;
    const cached = await this.redisService.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    const model = await this.modelRepository.findOne({
      where: { name, isProduction: true },
    });

    if (!model) {
      throw new NotFoundException(`No production model found for ${name}`);
    }

    await this.redisService.setex(cacheKey, 300, JSON.stringify(model));
    return model;
  }

  async update(id: string, updateModelDto: UpdateModelDto): Promise<MLModel> {
    const model = await this.findOne(id);
    
    Object.assign(model, updateModelDto);
    const updatedModel = await this.modelRepository.save(model);

    await this.invalidateCache(model.name);

    this.eventEmitter.emit('model.updated', {
      modelId: updatedModel.id,
      name: updatedModel.name,
      version: updatedModel.version,
    });

    return updatedModel;
  }

  async setProductionModel(id: string): Promise<MLModel> {
    return await this.dataSource.transaction(async manager => {
      await manager.update(
        MLModel,
        { name: (await manager.findOne(MLModel, { where: { id } })).name },
        { isProduction: false }
      );

      const model = await manager.findOne(MLModel, { where: { id } });
      model.isProduction = true;
      model.productionDeployedAt = new Date();
      
      const updatedModel = await manager.save(model);
      
      await this.invalidateCache(model.name);
      
      this.eventEmitter.emit('model.promoted', {
        modelId: updatedModel.id,
        name: updatedModel.name,
        version: updatedModel.version,
      });

      return updatedModel;
    });
  }

  async remove(id: string): Promise<void> {
    const model = await this.findOne(id);
    
    if (model.isProduction) {
      throw new ConflictException('Cannot delete production model');
    }

    await this.modelRepository.remove(model);
    await this.storageService.deleteModel(model.modelPath);
    await this.invalidateCache(model.name);

    this.eventEmitter.emit('model.deleted', {
      modelId: model.id,
      name: model.name,
      version: model.version,
    });
  }

  async getModelVersions(name: string): Promise<string[]> {
    const cacheKey = `models:${name}:versions`;
    const cached = await this.redisService.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    const models = await this.modelRepository.find({
      where: { name },
      select: ['version'],
      order: { version: 'DESC' },
    });

    const versions = models.map(m => m.version);
    await this.redisService.setex(cacheKey, 600, JSON.stringify(versions));
    
    return versions;
  }

  async updateMetrics(id: string, metrics: any): Promise<void> {
    await this.modelRepository.update(id, {
      performanceMetrics: metrics,
    });

    const model = await this.findOne(id);
    await this.redisService.setex(
      `model:${model.name}:${model.version}`,
      300,
      JSON.stringify(model)
    );
  }

  private async invalidateCache(name: string): Promise<void> {
    const keys = [
      `model:${name}:latest`,
      `model:${name}:production`,
      `models:${name}:versions`,
    ];

    await Promise.all(keys.map(key => this.redisService.del(key)));
  }
}
