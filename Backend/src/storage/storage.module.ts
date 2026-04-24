import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { StorageService } from './storage.service';
import { StorageController } from './storage.controller';
import { IpfsService } from './ipfs.service';

@Module({
  imports: [
    MulterModule.register({
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max per file
        files: 5,
      },
    }),
  ],
  controllers: [StorageController],
  providers: [StorageService, IpfsService],
  exports: [StorageService, IpfsService],
})
export class StorageModule {}
