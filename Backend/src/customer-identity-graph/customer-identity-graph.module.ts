import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CustomerIdentityGraphController } from './customer-identity-graph.controller';
import { CustomerIdentityGraphService } from './customer-identity-graph.service';
import { PrismaModule } from '../prisma.module';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [CustomerIdentityGraphController],
  providers: [CustomerIdentityGraphService],
  exports: [CustomerIdentityGraphService],
})
export class CustomerIdentityGraphModule {}
