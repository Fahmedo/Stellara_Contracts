import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma.service';
import { DatabaseReplicaService } from './database-replica.service';

@Module({
  imports: [ConfigModule],
  providers: [PrismaService, DatabaseReplicaService],
  exports: [PrismaService, DatabaseReplicaService],
})
export class DatabaseModule {}
