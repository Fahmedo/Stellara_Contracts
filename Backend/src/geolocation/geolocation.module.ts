import { Module, Global } from '@nestjs/common';
import { GeolocationService } from './geolocation.service';
import { PrismaService } from '../prisma.service';

@Global()
@Module({
  providers: [GeolocationService, PrismaService],
  exports: [GeolocationService],
})
export class GeolocationModule {}
