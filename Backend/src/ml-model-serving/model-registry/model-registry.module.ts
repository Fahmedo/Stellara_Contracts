import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModelRegistryController } from './model-registry.controller';
import { ModelRegistryService } from './model-registry.service';
import { MLModel } from './entities/ml-model.entity';
import { RedisModule } from '../../redis/redis.module';
import { StorageModule } from '../../storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MLModel]),
    RedisModule,
    StorageModule,
  ],
  controllers: [ModelRegistryController],
  providers: [ModelRegistryService],
  exports: [ModelRegistryService],
})
export class ModelRegistryModule {}
