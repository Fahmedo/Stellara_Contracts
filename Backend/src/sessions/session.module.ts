import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { SessionService } from './session.service';
import { SessionsController } from './sessions.controller';

@Module({
  imports: [RedisModule],
  providers: [SessionService],
  controllers: [SessionsController],
  exports: [SessionService],
})
export class SessionModule {}
