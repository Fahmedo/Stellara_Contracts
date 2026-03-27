import { Module } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PrismaModule } from '../prisma.module';
import { AbiRegistryController } from './abi-registry.controller';
import { AbiRegistryService } from './abi-registry.service';

@Module({
  imports: [PrismaModule],
  controllers: [AbiRegistryController],
  providers: [AbiRegistryService, JwtAuthGuard, RolesGuard],
  exports: [AbiRegistryService],
})
export class AbiRegistryModule {}
